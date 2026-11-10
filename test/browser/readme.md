# Passive WebGPU regression test

With the development server running and the existing browser listening on port 9223:

```sh
bun test/browser/run.ts
```

The runner attaches with `defaultViewport: null`. It does not navigate, focus, resize, send input, or attach elements to the page. The fixture renders to a detached canvas and verifies real WebGPU pixels, alpha, orientation, late material maps, StrictMode effect replay, and final canvas disposal. It uses the running Vite dependency generation to avoid loading a second React or Three instance. Fixture code is bundled into a data URL to avoid registering it for Vite HMR.

Run after source edits and Vite dependency optimization settle. A page reload during the test destroys its execution context and requires a new run.

For same-size WebGPU render-target recreation (Three #34301), which previously left cached render-pass descriptors pointing at destroyed GPU textures:

```sh
bun test/browser/run.ts webgpuRenderTargetRecreation.ts
```

Restart Vite first after changing a patched dependency so its optimized Three bundle includes the patch. The fixture renders to a detached RGBA16F target, forces `texture.needsUpdate` without changing target dimensions, renders again, and rejects any WebGPU validation error.

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

This standalone fixture lights a closed, double-sided room with a single shadow-casting point light, so every surface sees the light and the shadowed render must match the same render at shadow intensity 0. It compares the darkened fraction against three’s own filter. Before the filters compared each lookup against the depth of its own cube face (three’s r187 fix for point shadow seams), they darkened about three times as much of the room, along the seams between the cube’s faces.

For the studio that photographs thrown props for their fusion with a hung portrait:

```sh
bun test/browser/run.ts studioSnapshot.ts
```

This detached fixture draws the gallery’s shared gold with a renderer of its own first, then photographs a gold apple twice and a white and a charcoal ball with `StudioSnapshotRenderer`. It decodes the WebPs and checks that no object pixel lies outside the middle 960 px, that the object reaches that window’s edge, that the backdrop gray contrasts with the measured lightness and that both snapshots of the apple frame alike. It reports the first (device creation) and warm snapshot times.

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

This builds the gallery and starts it once in every room with `?room`, each in a private headless browser without input. Every room but the Lobby streams in after the page, bringing its floors, so the physics waits for them; once none is loading anymore, the player has to stand grounded at the room’s spawn. It caught the physics hold reaching the scene too late, which let the player fall through the floors of a start room that had not mounted yet. `LIVE_TARGET` reuses a build like for the Oculus test.