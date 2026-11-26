import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'

import {frames} from '#src/frames/index.ts'
import {choiceFrames} from '#src/frames/lib/frameChoice.ts'
import {frameIds} from '#src/frames/lib/frameParameter.ts'
import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import {hangingOffset} from '#src/lib/placement/wallGeometry.ts'
import {orbs} from '#src/orbs/index.ts'
import {studioFrames} from '#src/rooms/studio/look.ts'
import gallery from '#src/worlds/gallery/index.ts'
import knottingham from '#src/worlds/knottingham/index.ts'
import cell from '#src/worlds/sandbox/cell.ts'

import {radians} from './lib/headlessGallery.ts'
import snap from './snap.ts'

/** Photograph every frame on the seed 0 Studio’s north wall in eight labeled columns. */
export default function snapFrames() {
  const columns = 8
  const rows = Math.ceil(frameIds.length / columns)
  const roomWidth = 12
  const roomHeight = 12
  const wallMargin = 0.6 // meters around the grid
  const columnWidth = (roomWidth - 2 * wallMargin) / columns
  const rowHeight = (roomHeight - 2 * wallMargin) / rows
  const imageSide = Math.min(columnWidth, rowHeight) - 0.4 // meters, leaving clearance between frames
  const size = imageSide ** 2 * 10_000 // square image area in cm²
  const labelGap = 0.03 // meters below the frame’s outer edge
  const height = 8192
  const sidePadding = 64 // pixels on either side of the framed portraits
  const cameraZ = 14
  const fov = 45
  const focalLength = height / (2 * Math.tan(radians(fov / 2))) // pixels
  const portraitZ = hangingOffset - wallFace // the north wall’s face is at z = 0
  const portraits = framesByUsage().map((frame, index) => ({
    frame,
    x: (index % columns - (columns - 1) / 2) * columnWidth,
    y: roomHeight / 2 + ((rows - 1) / 2 - Math.floor(index / columns)) * rowHeight,
  }))
  // Project each frame’s outer edge at its nearest depth, relative to the centered camera.
  const halfWidth = Math.max(...portraits.map(({frame, x}) => {
    const {front, reach} = frames[frame]
    return focalLength * (Math.abs(x) + imageSide / 2 + reach) / (cameraZ - portraitZ - front)
  }))
  // Portraits are placed relative to the wall’s middle; overlay labels use world coordinates.
  const tools = portraits.flatMap(({frame, x, y}) => [{
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
  }])
  return snap({
    room: 'studio',
    seed: 0,
    portraits: 0,
    room_width: roomWidth,
    room_depth: 16,
    room_height: roomHeight,
    position: `${roomWidth / 2},${roomHeight / 2},${cameraZ}`,
    angle: '0,0',
    fov,
    width: Math.ceil(2 * (halfWidth + sidePadding)),
    height,
    'text-overlays': true,
  }, tools)
}

/** Sort by every frame a room or Orb can choose, including choices outside the default seed. */
function framesByUsage() {
  const rooms = [...gallery.rooms, ...knottingham.rooms, ...cell.rooms]
  // The Studio rolls one frame for the entire room, so use its sampler rather than one seed’s result.
  const roomFrames = new Set([...studioFrames, ...rooms.flatMap(({room}) => choiceFrames(room.frame ?? 'classic'))])
  const orbFrames = new Set(orbs.flatMap(orb => choiceFrames(orb.frame ?? [])))
  const rank = (frame: PortraitFrameId) => (roomFrames.has(frame) ? 0 : (orbFrames.has(frame) ? 1 : 2))
  return frameIds.toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}
if (import.meta.main) {
  const {output} = await snapFrames()
  console.log(`Wrote ${output}`)
}
