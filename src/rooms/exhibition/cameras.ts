import type {RoomCamera} from '../base/Room.ts'

import {tunnelSkew, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'

export default {
  // At the tunnel’s high south end, looking down its slope between the displays.
  overview: {
    position: [8.78 * tunnelSkew, 3, 8.78],
    aim: {
      yaw: Math.atan(tunnelSkew),
      pitch: -Math.atan(tunnelSlope / Math.hypot(1, tunnelSkew)),
    },
    fov: 80,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
