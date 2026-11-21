import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [1.613, 1.363, -31.903],
    aim: {
      yaw: -2.5871,
      pitch: 0,
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
  tunnel: {
    position: [0, 1.16, 28.024],
    aim: {
      yaw: 0,
      pitch: 0,
    },
    fov: 100,
    ratio: 16 / 9,
  },
  window: {
    position: [0.377, 2.349, -19.854],
    aim: {
      yaw: -0.8839,
      pitch: -0.1888,
    },
    fov: 70,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
