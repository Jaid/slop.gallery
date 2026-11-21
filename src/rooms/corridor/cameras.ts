import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [1.613, 1.363, -31.903],
    aim: {
      yaw: -2.5871,
      pitch: -0.0116,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  stairs: {
    position: [-1.783, 1.474, 26.227],
    aim: {
      yaw: -2.0531,
      pitch: 0.1252,
    },
    fov: 60,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
