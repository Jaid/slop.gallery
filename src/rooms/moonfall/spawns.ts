import type {RoomSpawn} from '../base/Room.ts'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import staircase, {stairFloorHeight} from '#src/lib/gallery/staircase.ts'

const x = staircase.endX + 2.6
const z = staircase.returnZ
const y = stairFloorHeight(x, z)! - lowerGallery.floorY + 0.04

export default {
  '': {
    position: [x - lowerGallery.moonfall.center[0], y, z - lowerGallery.moonfall.center[1]],
    yaw: Math.PI / 2,
    pitch: -0.09,
  },
} satisfies Record<string, RoomSpawn>
