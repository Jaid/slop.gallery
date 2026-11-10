# Frames

A frame (`base/PortraitFrame.ts`) is a kind of frame works hang in: its moulding swept round the work, its ornaments and its materials, built for any size of work. Every frame lives in a folder of its own, `src/frames/<id>`, with whatever only it needs, like the Ossuary’s `skull.ts`, and `index.ts` holds one of each by its id. `lib/frameParameter.ts` lists the ids, so `?frame` and the types know them without loading any frame.

Nothing but its id ties a frame to where it hangs. Rooms and fusion ingredients, like the orbs, name the frames they bring in their `frame`: one id, or several, of which `pickFrame` (`lib/frameChoice.ts`) draws one by the environment seed, for every work on its own in a room and once per game for an ingredient. Several rooms or ingredients may bring the same frame, and `test/unit/frames.test.ts` only asks that every frame but `classic`, the default, is brought by someone.

`lib` holds what frames share: `FrameProfile.ts` (the moulding’s cross-section), `frameGeometry.ts` (sweeping it round the work, placing ornaments), `ornaments.ts`, `frameBack.ts` and `materials`, the materials frames are made of with their shader helpers, lit like `frameStudio.ts`.

Every frame stays within 2048 triangles at every size and reaches at most 15 cm out past its work, its back 9.5 cm behind the work’s middle, which the tests check for each.

To add a frame, give it a folder with its class `<Id>Frame.ts`, add its id to `frameIds` and the frame to `index.ts`, and name it in a room’s or an ingredient’s `frame`.
