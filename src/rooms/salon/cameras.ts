import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-4.907, 3.184, 7.219],
    aim: {
      yaw: -0.6775,
      pitch: -0.1956,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  sculpture: {
    position: [0.022, 1.693, 10.438],
    aim: {
      yaw: -0.0003,
      pitch: 0.0032,
    },
    fov: 30,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
