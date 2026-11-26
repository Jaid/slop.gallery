# Frames

A frame (`base/PortraitFrame.ts`) is a kind of frame works hang in: its moulding swept round the work, its ornaments and its materials, built for any size of work. Every frame lives in a folder of its own, `src/frames/<id>`, with whatever only it needs, like the Ossuary’s `skull.ts`, and `index.ts` holds one of each by its id. `lib/frameParameter.ts` lists the ids, so `?frame` and the types know them without loading any frame.

Rooms and fusion ingredients name their frames in `frame`. In the default environment (`?seed=0`), `pickFrame` takes the first frame in the sampler. Other seeds draw one per work in a room and once per game for an ingredient. Samplers can overlap, and frames outside every sampler remain available through `?frame`.

`lib` holds what frames share: `FrameProfile.ts` (the moulding’s cross-section), `frameGeometry.ts` (sweeping it round the work, placing ornaments), `ornaments.ts`, `frameBack.ts` and `materials`, the materials frames are made of with their shader helpers, lit like `frameStudio.ts`.

Every frame stays within 8192 triangles at every size in fast and heavy graphics and within 32 768 in cinematic graphics (`GraphicsProfile.frameTriangles`, which `createGeometry` takes), and reaches at most 15 cm out past its work, its back 9.5 cm behind the work’s middle, which the tests check for each. A frame lays its ornaments out by the fast and heavy budget in every mode, so cinematic graphics may only cut them finer, `frameDetail` times along each of their directions, and never add or move one.

Louis XIV shell uses the same 1058-triangle mesh and crackle-free gilt in every graphics mode. Where screen-space reflections are enabled, only gold with roughness ≤ 0.25 traces a ray; rougher leaf still reflects the frame’s studio environment.

To add a frame, give it a folder with its class `<Id>Frame.ts`, add its id to `frameIds` and the frame to `index.ts`. Name it in a room’s or an ingredient’s `frame` to include it in that sampler.
