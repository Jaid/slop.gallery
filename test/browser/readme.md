# Passive WebGPU regression test

With the development server running and the existing browser listening on port 9222:

```sh
bun test/browser/run.ts
```

The runner attaches with `defaultViewport: null`. It does not navigate, focus, resize, send input, or attach elements to the page. The fixture renders to a detached canvas and verifies real WebGPU pixels, alpha, orientation, late material maps, StrictMode effect replay, and final canvas disposal. It uses the running Vite dependency generation to avoid loading a second React or Three instance. Fixture code is bundled into a data URL to avoid registering it for Vite HMR.

Run after source edits and Vite dependency optimization settle. A page reload during the test destroys its execution context and requires a new run.

For full-size nameplate atlas uploads, instanced UV row boundaries and late material invalidation:

```sh
bun test/browser/run.ts knotLabels.ts
```

This fixture uploads a 7200 × 8160 canvas atlas and checks the accent and background pixels of its first, row-boundary and final populated tiles. It does not interact with the live gallery.

For the reviewed Mage materials' black-sector regressions:

```sh
bun test/browser/run.ts knotMaterialRepairs.ts
```

This detached HDR fixture checks the analytic studio and Amber Vigil, Rime Cathedral, and Moiré Vespers from four angles at three distances. It rejects non-finite channels and unintended black pixels without touching the live scene.

For complete Abyssal Pulse photophores:

```sh
bun test/browser/run.ts abyssalPulse.ts
```

This detached fixture reads the actual GPU feature seeds and checks thousands of organ-core samples, including cross-cell support, against the isolated photophore mask. Nearby features must not cut off an active organ.

For Knotty Prince’s solid felt core and unchanged frayed shell:

```sh
bun test/browser/run.ts knottyPrince.ts
```

The detached fixture reproduces the original alpha-cut slices, checks core coverage across 24 views and animation phases and verifies retained fuzz outside the core.
For the shared satin stainless steel on the Lobby benches, Oculus railings and Knottingham nameplate supports:

```sh
bun test/browser/run.ts brushedMetal.ts --standalone
```

This detached HDR fixture uses the real frame, bent rail and sign geometry with UVs removed, in 24 views/scales and without scene lights or a scene environment. It rejects non-finite pixels, black sectors, overly bright broad reflections and missing light/dark structure. It also compares ordinary and rotated instanced supports and checks that moving a support does not move its local grain. The shader uses a static procedural studio environment, not live reflections. Knottingham keeps its existing flat-color support fallback in fast graphics; the benches and Oculus railings use the shared steel in both modes.
For the gallery’s point light shadow filters (heavy’s 4 and cinematic’s 16 lookups instead of three’s 5):

```sh
bun test/browser/run.ts pointShadowSeams.ts --standalone
```

This standalone fixture lights a closed, double-sided room with a single shadow-casting point light, so every surface sees the light and the shadowed render must match the same render at shadow intensity 0. It compares the darkened fraction against three’s own filter. Before the filters compared each lookup against the depth of its own cube face (three’s r187 fix for point shadow seams), they darkened about three times as much of the room, along the seams between the cube’s faces. The wide 3° blur of a fusion portal’s shadows may darken up to 6%: its lookups compare against the fragment’s own surface, so only the corners shade each other (about 4.8%), while three’s filter 2° wide already darkened 76% of the room.

For the studio that photographs thrown props for their fusion with a hung portrait:

```sh
bun test/browser/run.ts studioSnapshot.ts
```

This detached fixture draws the gallery’s shared gold with a renderer of its own first, then photographs a gold apple twice and a white and a charcoal ball with `StudioSnapshotRenderer`. It decodes the WebPs and checks that no object pixel lies outside the middle 960 px, that the object reaches that window’s edge, that the backdrop gray contrasts with the measured lightness and that both snapshots of the apple frame alike. It reports the first (device creation) and warm snapshot times.

For the studio view the pause menu shows a work of its collection in:

```sh
bun test/browser/run.ts studioView.ts --standalone
```

This standalone fixture shows works in a `StudioView` with their real frames and an image whose quarters tell its corners apart, and reads the canvas back. It checks that a work stands upright and unmirrored in the middle of a transparent backdrop and fills the share of the canvas its framing aims for, that it fills as much from behind and doesn’t shrink at an angle, where the camera keeps its distance, that the camera moves closer and away, that on a stage off the middle of the canvas it stands in the middle of the stage and close up reaches past it, that another work takes its place while one replaced before it got there never shows, and that hiding empties the canvas. It reports how long the first work (device and pipelines) and the next one took to show.

For the sound of a fusion’s portal:

```sh
bun test/browser/run.ts fusionSound.ts
```

This standalone fixture renders a succeeding and a failing fusion offline with the portal’s own envelope, heard from 4 m in front of it, and checks for nonfinite samples, silence, headroom and a silent tail. It does not play audio or touch the page.

For the sounds of the party effects, which ingredients contribute to a fusion’s portal, like the Halloween Orb’s bats:

```sh
bun test/browser/run.ts partyEffectSounds.ts
```

This standalone fixture renders every effect’s sound offline together with the portal’s boom as the result flips out, heard from 4 m in front of the portal, and checks for nonfinite samples, an effect falling silent once the boom has rung out, headroom and a silent tail. It does not play audio or touch the page.

For the formats a work’s image is exported in from the pause menu’s collection:

```sh
bun test/browser/run.ts reencodeImage.ts --standalone
```

This standalone fixture re-encodes a PNG of noise with a transparent stripe as a PNG and as a WebP of quality 1 and requires both to keep every pixel, as the export relies on Chromium encoding WebP of quality 1 without loss. It reports both sizes and needs no GPU, clipboard or page state.

## Oculus keyboard traversal

```sh
BROWSER=/path/to/chromium bun run test:live:oculus
```

This builds the gallery and opens a private headless browser. The test walks the production player through the sloped Moonfall connection in both directions, up the east two-flight switchback and down the west one, including both lateral landing turns. It checks grounded feet at each destination and rejects browser errors. It uses fast graphics; the geometry and colliders are shared with heavy mode.

To reuse the build in `dist`, run `LIVE_TEST=true BROWSER=/path/to/chromium bun test test/oculus.live.test.ts`; `LIVE_TARGET` points it at another one.

## Spawning in every room

```sh
BROWSER=/path/to/chromium bun run test:live:spawn
```

This builds the gallery and starts it once in every room with `?room`, each in a private headless browser without input. Every room streams in after the page, bringing its floors, so the physics waits for them; once none is loading anymore, the player has to stand grounded at the room’s spawn. It caught the physics hold reaching the scene too late, which let the player fall through the floors of a start room that had not mounted yet. `LIVE_TARGET` reuses a build like for the Oculus test.

## World reach

```sh
BROWSER=/path/to/chromium bun run test:live:world-reach
```

This builds the gallery and opens it with every `?world_reach`: `all`, `room` from the Lobby, the Forge, the Oculus and the Bastion, and `neighbors` from Moonfall and the Lodge. Through the `analyze_world` WebMCP tool it checks that no mesh or light of a room out of reach is in the scene, that every lamp of a room in reach and none of the others exists, that only the works hanging in rooms in reach mounted, that exactly the rooms in reach mounted (`snapshot().mountedRooms`) and only their chunks downloaded, even once the player flies into a room out of reach, that `dump_portrait_slots` and the pause menu’s collection list only the slots and works in reach and that only their images downloaded, that the player stands at the spawn reached out from and that the page logs no new warnings. The pause map must show only rooms in reach on the player’s floor, the collection’s works and the arrow at the player’s world coordinates. `LIVE_TARGET` reuses a build like for the Oculus test.

## Sun-tight rooms

```sh
BROWSER=/path/to/chromium bun run test:live:sun-tight
```

This builds the gallery, opens it in the first room with `sunTight` and casts rays toward the sun of every lighting preset from points 75 cm apart throughout the sun-tight spaces (`sunTightSpaces` in `src/lib/gallery/sun.ts`). The shadow cache lets whatever changes wholly inside them leave the sun’s map alone, which only holds while the room’s shell stops every ray, so the rays only count the casters that stay in the map: neither those wholly inside, nor cutout, see-through or shader-moved ones. They cull faces as three’s shadow pass draws them. Every ray has to hit one. A failure lists where the sun gets in, like through a new opening in a ceiling: close it, or drop the room’s `sunTight`. `LIVE_TARGET` reuses a build like for the Oculus test.

## Intro → frozen pause

```sh
BROWSER=/path/to/chromium bun run test:live:intro-pause
```

This builds the gallery and presses the real Escape key on fresh and returning intro menus in Fast and Heavy graphics, then on a returning menu opened with `?room=oculus` instead of the intro orbit, and opens a page already paused with `?paused`. It checks that the camera stays on the intro’s orbit and the body at the spawn, the pause heading taking the focus, no pointer-lock round trip, frozen camera/physics/audio, no frames at rest, resize redraws, Resume giving the intro’s menu back with the camera circling on from where it stood, Play dropping the body from the camera afterward, Resume entering the game where there is no intro orbit and unchanged nonfreezing focus-loss menus. Modified, repeated, already-handled and text-input Escape events are ignored. Unlike capture tests, it opens the page with `test: 'false'` (`--test false`), as `?test=true` leaves the intro out, and `waitForGallery(page, {fly: false})` waits for readiness without requiring the fly hook.

To reuse a build, run `LIVE_TEST=true BROWSER=/path/to/chromium bun test test/intro-pause.live.test.ts`; `LIVE_TARGET` selects another build directory.

## Mood screens

```sh
BROWSER=/path/to/chromium bun run test:live:mood-vignette
```

This builds the gallery and captures the Impasto vignette from the real output quad through the capture bridge, facing a papered wall of the Cell, where nothing else moves, without antialiasing, so only paint tells two captures apart. In Fast graphics, whose pipeline is only the scene and the moods’ screens, on a portrait view: paint in the margins and none in the middle, other paint a few seconds later, as the brushes go on, and no trace of it once N suppresses the moods. In Heavy graphics under `?frozen_time`, on a landscape view: the same vignette standing still. And cast by the `cast_mood` tool with fading on: less of it a third of the way in than once it has arrived, and nothing left after the tool let go of it.

To reuse a build, run `LIVE_TEST=true BROWSER=/path/to/chromium bun test test/mood-vignette.live.test.ts`; `LIVE_TARGET` selects another build directory.
