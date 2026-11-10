# Ambience emitters

An ambience emitter is a looping ambient sound heard from a point in the world: a subclass of the `ambience-emitter` package’s `AmbienceEmitter` (see `src/lib/audio/readme.md` for how they sound). Every kind lives in a folder of its own, `src/ambience_emitters/<id>`, and `index.ts` holds the class of each by its id: `fire`, `fountain` and `hum`.

A kind knows neither a room nor a position. Whoever places one gives it an `EmitterPlacement` (`lib/EmitterPlacement.ts`): the id it goes by there, the point it sounds from and the rooms it is heard in, so the same kind can sound in several places at once. Rooms name the kind of each of their ambient sounds by its id, with where it sounds from relative to the room (`ambience: {fire: {emitter: 'fire', position: [0, 0.84, 4.2]}}`), the world places it (`world.ambience('lodge', 'fire')`), and a component of the scene sounds it while mounted with `useAmbienceEmitter` (`lib/ambienceEmitters.ts`), which may move it first, like the Lobby moves its fountain’s to the mouth of the fountain the seed rolled.

To add a kind, give it a folder with its class `<Id>Emitter.ts`, which takes an `EmitterPlacement`, and add it to `index.ts`.
