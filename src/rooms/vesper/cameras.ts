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
} satisfies Record<string, RoomCamera>
