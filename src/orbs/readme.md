# Orbs

An orb (`base/Orb.ts`) is a kind of glass ball the player carries and throws: an ingredient of the fusion of a portrait it is thrown into, which a success uses up. Every orb lives in a folder of its own, `src/orbs/<id>`, with the glass it is made of and, if a scene fills it, the photograph a fusion’s portal shows of it, and `index.ts` holds one of each, with the groups the game draws from: `orbs`, `promptOrbs` and `randomOrbs`.

What an orb brings along it only names by its id: its `mood` (`src/moods`), which comes over the world while the player holds it (the Atelier for the Paint Orb and Impasto for the Impasto Orb), the `frame` or frames its fusion’s result wears (`src/frames`) and the party `effect` or effects that burst out of its fusion’s portal and out of the alchemy machine’s cannon (`src/party_effects`). Of several frames or effects, every game rolls one by its seed, like the Horror Orb’s blood, staring eyes or flesh tendrils. None of those knows the orb.

`base` holds what orbs are built from: `Orb.ts`, `PromptOrb.ts` for an orb filled with a scene, which contributes a prompt and leaves a Transparent Orb behind, and `OrbGlassMaterial.ts`, the glass every orb’s own material fills with its scene. `lib` holds the shader helpers those fills share. `#component/Orb` is the prop of any of them.

To add an orb, give it a folder with its class `<Id>Orb.ts`, its glass material and its `photo.jxl`, and add it to `index.ts`; whatever makes it turn up in the game names it there, like `randomOrbs` or the alchemy machine’s `flavorSteering`.

## Frost Orb

Look for the turning six-armed crystal on the Vesper’s pedestals. `?room=vesper&seed=1` places it on the north-east pedestal; `?item=prop-orb-frost` puts one in the Sandbox. Holding or inspecting it brings on polar twilight and the sound of wind over a frozen lake.

Throw it into a hung portrait. With an image model connected, the prompt calls for a blizzard **inside the scene**: snow packs onto exposed surfaces and frost follows the subject’s contours without replacing the subject. Without AI, a worker makes a winter print of the actual image, catching snow on its ridges, growing ice flowers in the margins and carrying powder across it. This is still a local tint for `?download` and `?webhook`; `all` includes it. The work flips out in edge-lit acrylic with a crystal flurry, leaving the empty Transparent Orb behind.
