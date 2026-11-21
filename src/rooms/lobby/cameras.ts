import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-3.798, 4.067, -19.342],
    aim: {
      yaw: -2.8403,
      pitch: -0.2336,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  floor: {
    position: [-6.13, 0.9, 19.29],
    aim: {
      yaw: -0.46,
      pitch: 0.05,
    },
    fov: 75,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
