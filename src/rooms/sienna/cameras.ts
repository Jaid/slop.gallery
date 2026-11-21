import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-5.536, 3.123, -3.424],
    aim: {
      yaw: -2.2323,
      pitch: -0.2516,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  stairs: {
    position: [-7.297, 2.268, 11],
    aim: {
      yaw: -0.1091,
      pitch: -0.3388,
    },
    fov: 70,
    ratio: 16 / 9,
  },
  chandelier: {
    position: [0.175, 4.626, -2.142],
    aim: {
      yaw: 2.9892,
      pitch: -0.1728,
    },
    fov: 80,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
