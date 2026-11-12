import type {RoomSpawn} from '../base/Room.ts'

import {frameToWorld, tunnelCenter, tunnelFloorHeight, tunnelFrame} from '#src/lib/gallery/exhibitionTunnel.ts'

/** how far down the tunnel’s diagonal from its high south end the spawn stands */
const back = 1.5
const z = tunnelFrame.length - tunnelFrame.elbow - back
const [x, worldZ] = frameToWorld([0, z])

export default {
  // Near the top of the diagonal’s slope, looking down it toward the Oculus.
  '': {
    position: [x - tunnelCenter[0], tunnelFloorHeight(z) + 0.04 - tunnelCenter[1], worldZ - tunnelCenter[2]],
    yaw: tunnelFrame.yaw,
    pitch: -0.08,
  },
} satisfies Record<string, RoomSpawn>
