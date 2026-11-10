# Party effects

A party effect (`base/PartyEffect.ts`) is a special effect that bursts out of a point in the world: sprites the GPU animates by the seconds since then, in one instanced draw, and a sound that plays once at that moment. Every party effect lives in a folder of its own, `src/party_effects/<id>`, with its sprites, the flights they follow and its sound, and `index.ts` holds one of each by its id: `bats`, `blood`, `ghosts` and `strokes`.

A party effect belongs to nothing. It plays at a `PartySite` (`lib/partySite.ts`): the point it bursts out of, its origin, the level direction it faces and the floor’s height under it. Whoever shows one stages a `PartyShow` (`lib/PartyShow.ts`) of it at a site with `effect.stage(site)`, ahead of time where it can, so its pipelines compile while it still draws nothing, adds the show’s `root` to the scene and brings it along frame by frame with `show.update(since, audio)`, the seconds since it burst out. Two things do:

- A fusion’s portal, for every party effect its ingredients contributed: an orb names one by its id (`effect: 'blood'`), the portal stages it as it opens and lets it burst out of its middle as the result flips out, staying open until it is over.
- The alchemy machine’s cannon, which stages the party effect of an orb it gave a new flavor and lets it burst out of its muzzle with the shot.

Effects lay everything out relative to their origin, as `PartyOffset`s: to the right of someone facing the site, up and out the way it faces. They call the upright plane through the origin their wall, whether or not one stands there, and the moment they start the burst. `extent(floor, since)` tells where an effect still reaches, which films use to keep it in view (`scripts/renderFusion.ts --emphasis party`).

To add a party effect, give it a folder with its class `<Id>Effect.ts` and add it to `index.ts`; `test/unit/party-effects.test.ts` and `test/browser/partyEffectSounds.ts` then check it with the others.
