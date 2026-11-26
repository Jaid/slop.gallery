import {frames} from '#src/frames/index.ts'
import {frameIds} from '#src/frames/lib/frameParameter.ts'

import snap from './snap.ts'

/** Photograph every frame on the seed 0 Studio’s north wall in four labeled columns. */
export default function snapFrames() {
  const columns = 4
  const rows = Math.ceil(frameIds.length / columns)
  const rowHeight = 10.8 / rows
  const imageSide = rowHeight - 0.4 // meters, leaving clearance between frames
  const size = imageSide ** 2 * 10_000 // square image area in cm²
  const labelGap = 0.03 // meters below the frame’s outer edge
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
        anchor: 2,
        text: frame,
        position: {
          x: roomWidth / 2 + x,
          y: y - imageSide / 2 - frames[frame].reach - labelGap,
          z: 0.05, // project near the outer rim, 5 cm in front of the north wall
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
