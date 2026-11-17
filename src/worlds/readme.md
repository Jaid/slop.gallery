# World mounting reach

`?world_reach=all|room|neighbors` selects a fixed mounting scope for the page:

- `all` (default, also the fallback for unknown values): the whole selected world, with normal room streaming and visibility culling.
- `room`: only the room containing the player’s startup spawn.
- `neighbors`: that room plus exactly its entries in the world’s neighbor registry. In the gallery this is `relations.ts` → `rooms`, not just physically adjoining rooms and not a recursive traversal. The single-room Sandbox and Knottingham keep their one room in either limited mode.

The anchor uses the same arrival resolver as the player: a camera bookmark from `?spawn` wins over a spawn bookmark of the same ID; otherwise a spawn bookmark, `?room`’s default spawn or the world’s default spawn. An unknown bookmark or room preserves the existing fallback to the world’s spawn. Geofences decide which room owns the resulting position, including stacked rooms and stairways. A low development camera whose body is below the floor uses its eyes if the body matches no geofence. An arrival outside every geofence uses the world’s default room.

This is a capture and test facility, not a gameplay boundary. Openings are unchanged and look into the void where rooms were excluded. Walking, teleporting or posing the camera does **not** expand the scope. There are no extra walls or invisible barriers at its edge. Lighting can differ from `all`, since excluded rooms’ lamps and shadow casters do not exist.

## Captures

Every script using `galleryOptions` accepts `--world_reach`:

```sh
bun scripts/snap.ts --target dist --room lodge --world_reach room
bun scripts/snap.ts --target dist --bookmark moonfall-overview --world_reach neighbors
bun scripts/film.ts --target dist --recipe flight.json --room bastion --world_reach room
bun scripts/analyzeWorld.ts --target dist --room moonfall --world_reach neighbors
```

For a limited snap or film without an explicit `--room` or `--spawn`, the tool supplies `--room` from the snap’s requested position (including `--bookmark`) or the film’s first output position (including `--starting-frame`). This happens **before** loading the page. A position outside every room requires an explicit anchor. An explicit anchor always wins, so a camera outside a room can photograph it. A film still has one fixed reach, not the union of its path: use `all` when the flight needs more rooms.

`slopGallery.snapshot().worldReach` reports the mode, anchor and admitted room IDs. `analyze_world` retains the full room catalog but reports only objects that actually exist.

## Resource boundaries

The logical world catalog remains complete. Fences, openings, bookmarks, lamp definitions and portrait slots are metadata used to resolve arrivals, align shared boundaries and assign seeded works. Restricting reach must not reshuffle the same seed’s artwork or delete anything from the saved collection.

The scene must use `world.reachableRooms` or `world.reach.includes(id)` **before** creating resources:

- Each gallery room’s lazy `scene.tsx` owns its walls, colliders, fixtures and contents. Its wall-cut recipe is separate too, so runtime generation and any build-time snapshots are confined to the rooms requested. No room scene statically imports another room scene. Even the Lobby loads on demand; Moonfall owns its stairway.
- `GalleryMaterials` creates shared materials and textures on demand and disposes them together. Reading unrelated getters or destructuring all its properties would defeat the boundary.
- Lamps are created only for admitted rooms, before the first frame, keeping the shader light set stable as the rooms stream in. Ambient emitters and other fixture registrations follow their owning room components.
- Curios, portrait bodies, collection thumbnails, slot markers and sticky overlays are filtered before mounting. The complete portrait state remains intact; default assignment still runs over the complete catalog.
- Physics waits only for admitted rooms. Culling only traverses portals between admitted rooms; architectural openings to excluded rooms stay open.

Validation: `bun run check` checks the policy, arrival precedence, lazy materials and independently loadable production room chunks. `bun run test:live:world-reach` exercises every gallery room, two neighbor sets and the full world in production Chromium, checking actual downloads, walls, lamps, curios, portrait registrations and the absence of late scope expansion.
