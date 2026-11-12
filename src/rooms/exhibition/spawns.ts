import type {RoomSpawn} from '../base/Room.ts'

import {tunnelSkew} from '#src/lib/gallery/lowerGallery.ts'

export default {
  // Near the tunnel’s high south end, looking down its slope toward the Oculus.
  '': {
    position: [8.25 * tunnelSkew, 1.31, 8.25],
    yaw: Math.atan(tunnelSkew),
    pitch: -0.08,
  },
} satisfies Record<string, RoomSpawn>
