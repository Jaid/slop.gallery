# media creation

## examples

### simple photo

This is the simplest way of taking a photo. It will capture the Three canvas and save it to out/snap/*.jxl where the stem is the first unoccupied integer, starting with 1.

```TypeScript
import snap from './scripts/snap.ts'

await snap({
  target: 'dist', // directory containing an index.html to load the game from
  bookmark: 'lobby-overview' // src/rooms/*/cameras.ts files contain presets for camera position, angle and field of view
})
```

### cinematic render

To showcase a scene in the best possible way with no respect to performance, you can snap an 7680×4320 canvas and save in 3840×2160 using high-quality downscaling (linear-light lanczos from ImageMagick).

```TypeScript
import snap from './scripts/snap.ts'

await snap({
  target: 'dist',
  bookmark: 'lodge-gathering',
  graphics: 'cinematic',
  scale: 2
})
```

### wireframe

This is useful to show off triangle density of different areas of the world. It renders nothing but white polygon edges on a black background.

```TypeScript
import snap from './scripts/snap.ts'

await snap({
  target: 'dist',
  position: '5.146,-3.788,-43.6',
  angle: '146,-0.66',
  fov: 70,
  height: 4320,
  wireframe: JSON.stringify({
    direction: 'out',
    seam_intensity: 0,
    glow_duration: 0,
    line_width: 1
  })
})
```

### green wireframe with one specific mesh in red

```TypeScript
import snap from './scripts/snap.ts'

await snap({
  target: 'dist',
  position: '-12.665,1.766,-18.93',
  angle: '155,-9.37',
  fov: 80,
  height: 4320,
  wireframe: JSON.stringify({
    direction: 'out',
    seam_intensity: 0,
    glow_duration: 0,
    line_width: 1,
    highlight: 'alchemy-machine/{alchemy-machine,alchemy-cannon}',
    color: '#f00',
    highlight_color: '#0f0'
  })
})
```

### portrait

```TypeScript
import snap from './scripts/snap.ts'

await snap({
  target: 'dist',
  room: 'cell',
  portraits: 1,
  position: '-5,1.85,0',
  angle: '90,0',
  fov: 40
})
```

### custom portraits

```TypeScript
import snap from './scripts/snap.ts'

const call = new Proxy({}, {
  get: (_, name) => input => ({name, input})
})

await snap({
  target: 'dist',
  room: 'cell',
  portraits: 0,
  position: '5,1.7,2',
  angle: '-11,-3',
  fov: 42
}, [
  call.add_portrait({
    image: 'https://img.youtube.com/vi/MQeJYEN_lrg/maxresdefault.jpg',
    target: {wall_id: 'cell-north', position: {x: 3.75, y: 2}},
    title: 'This DIY Datacenter is NUTS',
    frame: 'containment',
    canvas_material: 'rag'
  }),
  call.add_portrait({
    image: 'https://github.com/jaid/slop.gallery/raw/HEAD/assets/icon.svg',
    target: {wall_id: 'cell-north', position: {x: 7.6, y: 2}},
    title: 'Slop Gallery',
    frame: 'maelstrom',
    canvas_material: 'linen'
  }),
  call.add_portrait({
    image: 'https://github.com/jaid.png',
    target: {wall_id: 'cell-north', position: {x: 5.78, y: 2}},
    title: 'Jaid',
    frame: 'kumiko',
    canvas_material: 'karakami'
  }),
  call.add_portrait({
    image: 'https://gstatic.com/webp/gallery/3.webp',
    target: {wall_id: 'cell-east', position: {x: -3.4, y: 2}},
    title: 'Winter walk',
    frame: 'twig',
    canvas_material: 'wax'
  })
])
```

### portrait slots

`show_portrait_slots` outlines every portrait slot, where works snap to when hung, with its frame and placard, colored by its aspect ratio. Behind a hung work, a slot keeps only a fifth of its opacity. `room: 'cell'` opens the Sandbox, the world of the Cell.

```TypeScript
import snap from './scripts/snap.ts'

await snap({
  target: 'dist',
  room: 'cell',
  position: '-3,2,-4',
  angle: '-155,-3',
  fov: 70,
  show_portrait_slots: true,
  portraits: 0
})
```

### length measurement

```TypeScript
import snap from './scripts/snap.ts'

const call = new Proxy({}, {
  get: (_, name) => input => ({name, input})
})

await snap({
  target: 'dist',
  position: '3.8,2.6,-27',
  angle: '-50,-46',
  fov: 90,
  portraits: 0,
  'text-overlays': true // Specifies to capture the page rather than the canvas because this is where the text overlays come from
}, [
  call.add_drawing({type: 'line', from: [3.5149, 0, -31.8], to: [3.5149, 0, -28]}),
  call.add_drawing({type: 'line', from: [3.4649, 0, -31.8], to: [3.5649, 0, -31.8]}),
  call.add_drawing({type: 'line', from: [3.4649, 0, -28], to: [3.5649, 0, -28]}),
  call.add_drawing({type: 'line', from: [7.728, 0, -27.6], to: [7.728, 1.2, -27.6]}),
  call.add_drawing({type: 'line', from: [7.728, 0, -27.65], to: [7.728, 0, -27.55]}),
  call.add_drawing({type: 'line', from: [7.728, 1.2, -27.65], to: [7.728, 1.2, -27.55]}),
  call.add_text_overlay({text: '380 cm', anchor: 7, position: {x: 3.5149, y: 0, z: -29.9}}),
  call.add_text_overlay({text: '120 cm', anchor: 9, position: {x: 7.728, y: 0.6, z: -27.6}})
])
```

### simple film

This is the simplest way of filming. It flies the camera along the keyframes given as the second argument and saves the film as a looping animated AVIF.

```TypeScript
import film from './scripts/film.ts'

await film({
  target: 'dist',
  'output-file': 'out/film/fountain.avif'
}, [
  {time: 4, orbit: {from: [0, 3.4, -6], focus: [0, 1.2, -12]}} // one full counterclockwise turn around the Lobby’s fountain in 4 seconds
])
```

### sculpture film

```TypeScript
import film from './scripts/film.ts'

const sculpture = [14.05, 2.1, -26.4]
const left = [10.55, 2, -20.34]
const right = [17.55, 2, -20.34]

await film({
  target: 'dist',
  width: 1080,
  height: 1080,
  world_reach: 'room', // mount only the Salon, the camera never sees out of it
  'output-file': 'temp/sculpture.avif'
}, [ 
  {time: 6, orbit: {from: left, to: right, focus: sculpture}, tween: 'easeInOutSine', fov: 38},
  {time: 12, orbit: {from: right, to: left, focus: sculpture}, tween: 'easeInOutSine'}
])
```

### seed cycling

```TypeScript
import film from './scripts/film.ts'

const fire = [-25, -4.04, -30.8]
const left = [-27.15, -2.54, -38.83]
const right = [-22.85, -2.54, -38.83]

await film({
  target: 'dist',
  seed: '{0..7}', // minimatch pattern
  room: 'lodge',
  duration: 1.5, // seconds per clip, here 8 × 1.5 = 12 seconds in total
  crossfade: 0.4, // seconds each seed fades into the next, the last one back into the first
  'output-file': 'out/film/lodge-fire-seeds.avif'
}, [
  {time: 6, orbit: {from: left, to: right, focus: fire}, tween: 'easeInOutSine'},
  {time: 12, orbit: {from: right, to: left, focus: fire}, tween: 'easeInOutSine'}
])
```

### switching the build in one movie

The target field can be an array of build folders. Each will be active for the specified clip duration and then continue filming keyframes defined in the recipe (the second `film()` argument). This is useful to have smooth camera motion through the world while showing off changes – in this example case a hatchet with its size doubled.

```TypeScript
import {Lang, parse} from '@ast-grep/napi'

import film from './scripts/film.ts'

await Bun.$`bun run build`
await using worktree = {
  folder: 'temp/worktree/hatchet',
  async [Symbol.asyncDispose]() { // Removes the worktree once the script ends, also after an error
    await Bun.$`git worktree remove --force ${this.folder}`
  }
}
await Bun.$`git worktree add --detach ${worktree.folder}`
const file = worktree.folder + '/src/lib/gallery/curios/hatchet/Hatchet.ts'
const code = await Bun.file(file).text()
const ast = parse(Lang.TypeScript, code).root()
const geometries = ast.findAll({rule: {pattern: {context: '({geometry: $GEOMETRY})', selector: 'pair'}}}).map(pair => pair.getMatch('GEOMETRY')) // the geometries of the hatchet’s head and haft
await Bun.write(file, ast.commitEdits(geometries.map(geometry => geometry.replace(`${geometry.text()}.scale(2, 2, 2)`)))) // scales both 2×
await Bun.$`bun install && bun run build`.cwd(worktree.folder)

const builds = ['dist', worktree.folder + '/dist']
const wide = {yaw: 180, pitch: -6, fov: 45}
const close = {yaw: 161.7, pitch: -9.5, fov: 32} // aimed at the hatchet

await film({
  target: [...builds, ...builds], // one clip per build in this order: dist, big, dist, big
  room: 'lodge',
  world_reach: 'room',
  duration: [2, 3, 2, 3], // seconds of each clip, so the zoom in (4–5 seconds) and out (9–10 seconds) both happen with the big hatchet
  scale: 2,
  'output-file': 'out/film/large_hatchet.avif'
}, [
  {time: 0, position: [-25.8, -3.66, -33.62], ...wide},
  {time: 4, ...wide},
  {time: 5, ...close, tween: 'easeInOutSine'},
  {time: 9, ...close},
  {time: 10, ...wide, tween: 'easeInOutSine'}
])
```

### hanging a portrait

Keyframes can run the app’s WebMCP tools at their time, here `add_portrait` a second in.

```TypeScript
import film from './scripts/film.ts'

await film({
  target: 'dist',
  room: 'cell',
  portraits: 0, // start with empty walls
  width: 720,
  height: 720,
  scale: 2, // render at twice the size and scale down, for smoother edges
  duration: 3.5, // seconds, longer than the keyframes, which end at 1 s
  crossfade: 0.5, // seconds the end fades back into the empty wall at the beginning, so the film loops
  'output-file': 'out/film/hanging.avif'
}, [
  {time: 0, position: [7.88, 2.3, -1.14], yaw: 30, pitch: -7, fov: 42}, // 4.2 m off the wall, 30° to the right of facing it
  {time: 1, tools: {add_portrait: {
    image: 'https://github.com/jaid.png',
    target: {wall_id: 'cell-north', position: {x: 5.78, y: 2}},
    title: 'Jaid',
    frame: 'kumiko',
    canvas_material: 'karakami',
    hanging_animation: true // fly onto the wall like a work the player hangs instead of appearing there
  }}}
])
```

### fusion film

20 seconds AV1 + Opus to out/fusion/*.webm

```TypeScript
import renderFusion from './scripts/renderFusion.ts'

// by default a Spook Orb thrown into the first work of the Banquet, in cinematic graphics with sound, 20 s as an AV1 WebM
await renderFusion({
  target: 'dist',
  width: 1080,
  height: 1080,
  scale: 2, // renders at 2160×2160 and downsamples each frame, for smoother edges
  emphasis: 'result' // ends looking straight at the result where it lands, which a quick low-resolution probe render finds first
})
```
