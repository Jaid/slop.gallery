import type {RoomSpawn} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import {stairFlights} from '#src/lib/gallery/staircase.ts'

const [originX, originY, originZ] = roomOrigins.moonfall
const [, lower] = stairFlights
const [headingX, headingZ] = lower.heading
/** the lower flight’s tread seven risers up from the hall’s floor, as high up as visitors always arrived */
const tread = lower.blocks.filter(block => block.tread).at(-8)!
/** how far toward the tread’s front edge, down the flight, visitors stand, so the player’s capsule clears the riser up behind them */
const forward = 0.12
/** On a lower tread, looking down the flight through the east door past the crater. */
export const stairArrival = [tread.position[0] + headingX * forward - originX, tread.top + 0.04 - originY, tread.position[2] + headingZ * forward - originZ] satisfies RoomSpawn['position']

export default {
  '': {
    position: stairArrival,
    yaw: Math.PI / 2,
    pitch: -0.09,
  },
} satisfies Record<string, RoomSpawn>
