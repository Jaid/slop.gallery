import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-5.105, 5.096, 11.233],
    aim: {
      yaw: -0.8023,
      pitch: -0.2636,
    },
    fov: 70,
    ratio: 16 / 9,
  },
  floor: {
    position: [-0.83, 0.47, -11.09],
    aim: {
      yaw: -2.8,
      pitch: 0.09,
    },
    fov: 70,
    ratio: 16 / 9,
  },
  orbs: {
    position: [-3.979, 2.845, 0],
    aim: {
      yaw: -0.7443,
      pitch: -0.3808,
    },
    fov: 30,
    ratio: 16 / 9,
  },
  orb: {
    position: [0.112, 1.901, -2.369],
    aim: {
      yaw: -0.9536,
      pitch: -0.3636,
    },
    fov: 30,
    ratio: 1,
  },
} satisfies Record<string, RoomCamera>
