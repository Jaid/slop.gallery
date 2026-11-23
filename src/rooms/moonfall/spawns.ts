import type {RoomSpawn} from '../base/Room.ts'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {stairFloorHeight} from '#src/lib/gallery/staircase.ts'

// Near the west edge of step 15 (x ∈ [8.727, 9.182]), keeping the 30 cm player capsule clear of step 14’s riser behind it.
const localX = 16.8
const [originX, originZ] = lowerGallery.moonfall.center

export default {
  '': {
    position: [localX, stairFloorHeight(originX + localX, originZ)! - lowerGallery.floorY + 0.04, 0],
    yaw: Math.PI / 2,
    pitch: -0.09,
  },
} satisfies Record<string, RoomSpawn>
