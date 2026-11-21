import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [3.488, 1.996, -6.192],
    aim: {
      yaw: 2.6361,
      pitch: -0.1376,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  fire: {
    position: [-0.068, 1.306, 1.382],
    aim: {
      yaw: 3.1409,
      pitch: 0.0552,
    },
    fov: 80,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
