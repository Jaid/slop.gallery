# Slop Gallery

<center>
<a href="https://slop.gallery">
<img src="https://slop.gallery/jGSspOJ6.svg" width=200>
</a>

[slop.gallery](https://slop.gallery) | [canary](https://main.slop.gallery) | [source](https://github.com/Jaid/slop.gallery)
</center>

## Mounting reach

`?world_reach=room|neighbors|all` fixes how much of a world mounts for the entire page session. Missing or invalid values use `all`, the normal full world.

- `room`: only the room containing the startup spawn position.
- `neighbors`: that room plus exactly its `rooms` list in the gallery’s `src/worlds/gallery/relations.ts`. This is one lookup, not a transitive walk through doors or through neighbors’ neighbors.
- `all`: every room.

The startup position follows the usual selection: `?spawn` (camera bookmark before spawn bookmark), then `?room`, then the world’s default spawn. An unknown bookmark falls back to the default spawn, ignoring `?room`; an unknown room or a position outside every room also falls back to the default room. The Sandbox and Knottingham have only one room, so every reach keeps that room.

Excluded rooms have no models, wall geometry, colliders, lamps, ambient emitters, initial props or portrait bodies. Openings remain open to the empty space beyond. Shared world lighting and room metadata remain available. The complete portrait collection and slot assignment stay intact, preserving saved works and the seed’s layout; only reached works create models and decode images.

### Captures

The shared headless options forward `--world_reach` to the URL, including in `snap.ts`, `film.ts` and `analyzeWorld.ts`:

```sh
bun scripts/snap.ts --target dist --bookmark lodge-overview --world_reach room
bun scripts/film.ts --target dist --room lodge --world_reach neighbors --recipe my-camera-track.json
bun scripts/analyzeWorld.ts --target dist --room bastion --world_reach room
```

A scoped `snap.ts --bookmark` also selects that bookmark as the startup spawn unless `--room` or `--spawn` explicitly selects another. `--position`, later teleports and film camera tracks **do not change the reach**. Choose `--room` or `--spawn` to anchor those captures, and use `all` for tracks crossing the scope’s boundary. Walking out of a reached room does not load more rooms or add an invisible barrier.

`slopGallery.snapshot()` reports the fixed `worldReach` and the gallery’s currently committed `mountedRooms`. `bun run test:live:world-reach` checks room scopes, exact neighbor scopes, both full-world defaults, registry membership, grounding and actual room-component downloads against a production build.
