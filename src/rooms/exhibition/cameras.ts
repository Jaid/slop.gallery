import type {RoomCamera} from '../base/Room.ts'

import {frameToWorld, tunnelCenter, tunnelFloorHeight, tunnelFrame} from '#src/lib/gallery/exhibitionTunnel.ts'

/** how far down the tunnel’s diagonal from where its slope ends at the high south end the overview stands */
const back = 0.6
const z = tunnelFrame.length - tunnelFrame.elbow - back
const [x, worldZ] = frameToWorld([0.08, z])

export default {
  // At the top of the diagonal’s slope, looking down it between the displays.
  overview: {
    position: [x - tunnelCenter[0], tunnelFloorHeight(z) + 2.16 - tunnelCenter[1], worldZ - tunnelCenter[2]],
    aim: {
      yaw: tunnelFrame.yaw + 0.02,
      pitch: 0.01,
    },
    fov: 80,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
