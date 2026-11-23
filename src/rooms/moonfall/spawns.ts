import type {RoomSpawn} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import {stairFlights} from '#src/lib/gallery/staircase.ts'

const [originX, originY, originZ] = roomOrigins.moonfall
const [, lower] = stairFlights
const [headingX, headingZ] = lower.heading
/** the lower flight’s tread six treads up from its foot, where visitors arrive looking down into the hall */
const tread = lower.blocks.filter(block => block.tread).at(-6)!
/** how far toward the tread’s front edge, down the flight, visitors stand, so the player’s capsule clears the riser up behind them */
const forward = 0.12

export default {
  '': {
    position: [tread.position[0] + headingX * forward - originX, tread.top + 0.04 - originY, tread.position[2] + headingZ * forward - originZ],
    yaw: 0,
    pitch: -0.09,
  },
} satisfies Record<string, RoomSpawn>
