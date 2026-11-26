import {frameIds} from '#src/frames/lib/frameParameter.ts'

import snap from './snap.ts'

/** Photograph every frame on the seed 0 Studio’s north wall in four labeled columns. */
export default function snapFrames() {
  const columns = 4
  const rows = Math.ceil(frameIds.length / columns)
  const rowHeight = 10.8 / rows
  const size = (rowHeight - 0.4) ** 2 * 10_000 // square image area in cm² after leaving clearance between frames
  const roomWidth = 8
  const roomHeight = 12
  const tools = frameIds.flatMap((frame, index) => {
    // Portraits are placed relative to the wall’s middle; overlay labels use world coordinates.
    const x = (index % columns - (columns - 1) / 2) * 0.9
    const y = roomHeight / 2 + ((rows - 1) / 2 - Math.floor(index / columns)) * rowHeight
    return [{
      name: 'add_portrait',
      input: {
        frame,
        size,
        image: 'https://github.com/Jaid/slop.gallery/raw/HEAD/assets/avatar.webp',
        target: {
          wall_id: 'studio-north',
          position: {
            x,
            y,
          },
        },
      },
    }, {
      name: 'add_text_overlay',
      input: {
        text: frame,
        position: {
          x: roomWidth / 2 + x,
          y: y - rowHeight / 2,
          z: 0.1,
        },
      },
    }]
  })
  return snap({
    room: 'studio',
    seed: 0,
    portraits: 0,
    room_width: roomWidth,
    room_depth: 16,
    room_height: roomHeight,
    position: `${roomWidth / 2},${roomHeight / 2},14`,
    angle: '0,0',
    fov: 45,
    width: 1350,
    height: 4320,
    'text-overlays': true,
  }, tools)
}

if (import.meta.main) {
  const {output} = await snapFrames()
  console.log(`Wrote ${output}`)
}
