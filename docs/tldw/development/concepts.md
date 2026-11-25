The game bundle contains several worlds, located in src/worlds/*

Each world defines one or multiple rooms that are then glued together to a cohesive environment. A world also defines clearing backgrounds (skyboxes), global lighting and room culling rules

# for players

## Gallery

main world and the only one meant to be played in

Drop or paste an image or video to turn it into a portrait. For videos, the gallery keeps the first frame your browser can decode and frames it just like an imported image. Dropping files while paused adds them to the collection.

# for developers, agents and scripts

## Sandbox

## Cell variant

a simple wooden one-room house with a nice moody/spooky/comfy atmosphere and a large amount of roof openings that let moonlight rays in and reveal a high-quality night sky shader

## Studio variant

a fully dynamically generated room that supports a large variety of customization options

This is useful to experiment with and review different combinations of lighting, materials and visual effects. It should also be used for creating media with scripts/{snap,film}.ts whenever nothing from Cell or Gallery is needed

Another intended use is quickly testing new objects and materials on a large variety of environments and conditions. For example, after a new portrait frame mesh + material was designed and is now supposed to be human-reviewed, a movie of the frame can be recorded in Studio with a camera that orbits around it while cycling through like 20 different Studio seeds

Live customization is done by optionally picking a seed for the room’s base preset and then refining the scene with WebMCP tool calls

### customized room

The set_world_tuning WebMCP tool can be used to override the current Studio room’s traits

Example for capturing a custom portrait in a custom Studio:

```TypeScript
import snap from './scripts/snap.ts'

const call = new Proxy({}, {
  get: (_, name) => input => ({name, input})
})

await snap({
  room: 'studio',
  portraits: 0, // no default work in the slot, where the custom one hangs instead
  development: true // set_world_tuning only takes effect with ?development
}, [
  call.add_portrait({
    image: 'https://pbs.twimg.com/media/HWO9FDjaIAAfhDz?format=jpg&name=orig',
    target: {wall_id: 'studio-north', position: {x: 0, y: 2}}, // from the wall’s middle, right in front of the spawn
    frame: 'kumiko',
    canvas_material: 'karakami'
  }),
  call.set_world_tuning({values: {studio: {
    lightColor: {saturation: 0, lightness: 100}, // OkHSL, any of hue, saturation and lightness left out at 0, 100 and 50
    lightStrength: 1,
    lightShafts: 0.05,
    primaryLampStrength: 15,
    secondaryLampStrength: 10,
    secondaryLampColor: {hue: 177, saturation: 20},
    secondaryLampDecay: 2,
    ambient: 0.31,
    hemisphere: 1,
    walls: 'clawds',
    floor: 'sienna',
    mirror: 0.2,
    mirrorBlur: 8
  }}})
])
```
