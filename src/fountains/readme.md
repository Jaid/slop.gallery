# Fountains

A fountain (`base/Fountain.ts`) is a kind of fountain that can stand somewhere in a world. Every fountain lives in a folder of its own, `src/fountains/<id>`, with its measures (`config.ts`), its geometry, its water, its materials and its model, and `index.ts` holds one of each by its id: `marble`, three tiers of white Arabescato with gadrooned bowls, lily jets and arcs out of its basin, and `limestone`, three brimming bowls of fossil limestone over five meters high with scalloped veils and a ring of jets.

A fountain is position-free: it is laid out around the middle of its foot, which stands on the floor, and whoever stands one somewhere decides where. Its class only tells what the world needs to know of it without building it, like how far it reaches, how high its water rises and where it sounds from. Its model (`components/<Id>FountainModel`), a component that takes the `id` it goes by there and its `position`, only loads for whoever shows it, through `loadModel()`.

The Lobby stands one in its middle, with four benches round it, and sounds its ambience from the mouth of its tallest jet. Which one, the environment seed rolls (`lobbyFountainId` in `src/lib/gallery/lobbyFountain.ts`), unless `?fountain` names one (`lib/forcedFountain.ts`). `src/rooms/lobby/components/LobbyFountain` awaits the rolled fountain’s model as it loads, so only that one downloads and the Lobby mounts with it in its first frame.

To add a fountain, give it a folder with its class `<Id>Fountain.ts` and its model and add it to `index.ts`; `test/unit/fountains.test.ts` then checks that it fits wherever the Lobby stands one, and every seed may roll it.
