import type {RoomSpawn} from '../base/Room.ts'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {stairFlights} from '#src/lib/gallery/staircase.ts'

const approach = stairFlights[1]
const tread = approach.blocks.at(-5)!
const [x, , z] = tread.position
/** On a lower tread, looking through the east door past the crater. */
export const stairArrival = [x - lowerGallery.moonfall.center[0], tread.top - lowerGallery.floorY + 0.04, z - lowerGallery.moonfall.center[1]] satisfies RoomSpawn['position']

export default {
  '': {
    position: stairArrival,
    yaw: Math.PI / 2,
    pitch: -0.09,
  },
} satisfies Record<string, RoomSpawn>
