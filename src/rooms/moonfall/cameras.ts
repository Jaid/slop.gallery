import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-13.818, 4.317, 9.831],
    aim: {
      yaw: -1.1259,
      pitch: -0.2956,
    },
    fov: 60,
    ratio: 16 / 9,
  },
  stairs: {
    // On the lower flight’s centerline, looking due west, so its walls frame the view symmetrically.
    position: [16.63, 3.1, 0],
    aim: {
      yaw: Math.PI / 2,
      pitch: -0.35,
    },
    fov: 60,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
