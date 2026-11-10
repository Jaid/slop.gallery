# Fountains

A fountain (`base/Fountain.ts`) is a kind of fountain that can stand somewhere in a world. Every fountain lives in a folder of its own, `src/fountains/<id>`, with its measures (`config.ts`), its geometry, its water, its materials and its model, and `index.ts` holds one of each by its id.

A fountain is position-free: it is laid out around the middle of its foot, which stands on the floor, and whoever stands one somewhere decides where. Its class only tells what the world needs to know of it without building it, like how far it reaches, how high its water rises and where it sounds from. Its model (`components/<Id>FountainModel`), a component that takes the `id` it goes by there and its `position`, only loads for whoever shows it, through `loadModel()`.

The Lobby stands one in its middle (`src/lib/gallery/lobbyFountain.ts`, `src/rooms/lobby/components/LobbyFountain`), with four benches round it, and sounds its ambience from the mouth of its tallest jet.

To add a fountain, give it a folder with its class `<Id>Fountain.ts` and its model and add it to `index.ts`; `test/unit/fountains.test.ts` then checks that it fits wherever the Lobby stands one.
