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

To showcase a scene in the best possible way with no respect to performance, you can snap an 8640×4320 canvas and save in 3840×2160 using high-quality downscaling (linear-light lanczos from ImageMagick).

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

`portraits: 1` hangs a single default work instead of the usual selection, drawn by the seed: with seed 0, the Cell hangs Mona Coo Lisa in the middle of its west wall, which this view faces straight on, with its placard.

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

`add_portrait` brings in an image from a URL, in JXL, PNG, JPEG, WebP, AVIF, GIF or SVG. With `portraits: 0`, the Cell starts empty, and these four hang around its north-east corner, each at a spot on a wall in its own aspect, at the room’s frame area, in the frame and on the canvas material each names: `x` runs along the wall from its middle, to the right as seen from the room, and `y` up from its foot. Instead, the target can be a portrait slot as `{slot}` or a world position as `{position: {x, y, z}}`, from which it falls.

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
    image: 'https://github.com/Jaid/slop.gallery/raw/HEAD/assets/icon.svg',
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

```TypeScript
import film from './scripts/film.ts'

const sculpture = [14.05, 2.1, -26.4]
const left = [9.246, 1.8, -24.41]
const right = [18.854, 1.8, -24.41]

await film({
  target: 'dist',
  seed: 3, // Antiphon
  'output-file': '~/sculpture.avif'
}, [ 
  {time: 6, orbit: {from: left, to: right, focus: sculpture}, tween: 'easeInOutSine', fov: 55},
  {time: 12, orbit: {from: right, to: left, focus: sculpture}, tween: 'easeInOutSine'}
])
```

### fusion film

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
