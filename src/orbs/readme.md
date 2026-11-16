# Orbs

An orb (`base/Orb.ts`) is a kind of glass ball the player carries and throws: an ingredient of the fusion of a portrait it is thrown into, which a success uses up. Every orb lives in a folder of its own, `src/orbs/<id>`, with the glass it is made of and, if a scene fills it, the photograph a fusion’s portal shows of it, and `index.ts` holds one of each, with the groups the game draws from: `orbs`, `promptOrbs` and `randomOrbs`.

What an orb brings along it only names by its id: its `mood` (`src/moods`), which comes over the world while the player holds it, the `frame` or frames its fusion’s result wears (`src/frames`) and the party `effect` or effects that burst out of its fusion’s portal and out of the alchemy machine’s cannon (`src/party_effects`). Of several frames or effects, every game rolls one by its seed, like the Horror Orb’s blood, staring eyes or flesh tendrils. None of those knows the orb.

`base` holds what orbs are built from: `Orb.ts`, `PromptOrb.ts` for an orb filled with a scene, which contributes a prompt and leaves a Transparent Orb behind, and `OrbGlassMaterial.ts`, the glass every orb’s own material fills with its scene. `lib` holds the shader helpers those fills share. `#component/Orb` is the prop of any of them.

To add an orb, give it a folder with its class `<Id>Orb.ts`, its glass material and its `photo.jxl`, and add it to `index.ts`; whatever makes it turn up in the game names it there, like `randomOrbs` or the alchemy machine’s `flavorSteering`.

## Impasto Orb

The Impasto Orb (`impasto`, prop `prop-orb-impasto`) turns up in the Vesper’s seeded random selection alongside the Transparent, Spook and Halloween Orbs. `?item=prop-orb-impasto` opens it in the Sandbox; `spawn_orb` also accepts `impasto`. It is separate from the Paint Orb and does not change the Painting Set’s Forge recipe. Like every flavored orb, it survives the alchemy machine unchanged.

Inside its clear glass, twenty thick knife strokes turn over an umber underpainting. The shader marches solid, tapered slabs with raised furrows, in local bounding boxes; their silhouettes and relief are geometry in the ray, not colored stripes. The glass, physics, grabbing, throwing and inspection are the shared orb implementation. Its own warm-light/cool-shadow “Impasto atelier” mood shares the Paint Orb’s studio sounds through `moods/base/AtelierAmbience.ts`.

Its prompt always asks for a **high-quality, detailed, cohesive, atmospheric, tactile and bold digital impasto artwork**, preserving the original content, subjects, composition and recognizable details. Unlike the other prompt orbs, these six qualities are fixed, not sampled by the seed. Only the target artwork’s image goes to the image model; the orb’s photograph is for the portal, not a second source image. The result wears the Canvas frame and releases the existing painted-stroke effect; a successful fusion consumes the orb and returns its clear glass as a Transparent Orb.

As with the other prompt orbs, a real style transformation requires AI and configured OpenRouter access. Without AI, the existing local fallback tints the image with the orb’s warm glow and describes it as a tint, not an impasto transformation. Provider errors follow the normal fusion failure path rather than consuming the orb.

`test/browser/impastoOrb.ts` renders the real material from several sides and frozen phases. Calling its default export with `true` also returns a supersampled 512 × 512 PNG of the studio view, used to make `impasto/photo.jxl` (`cjxl -d 0.5 -e 9`).
