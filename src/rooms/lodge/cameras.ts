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
    position: [0, 1.306, 1.382],
    aim: {
      yaw: Math.PI,
      pitch: 0.0552,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  gathering: {
    position: [4.729, 2.754, -1.879],
    aim: {
      yaw: 2.2249,
      pitch: -0.3328,
    },
    fov: 40,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
