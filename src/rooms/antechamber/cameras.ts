import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [0, 2.25, -3.72],
    aim: {
      yaw: Math.PI,
      pitch: 0.16,
    },
    fov: 89,
    ratio: 16 / 9,
  },
  west: {
    position: [-9.5, 1.63, -2.25],
    aim: {
      yaw: -2.53,
      pitch: 0.08,
    },
    fov: 76,
    ratio: 16 / 9,
  },
  east: {
    position: [4.75, 1.68, -1.6],
    aim: {
      yaw: -1.98,
      pitch: 0.13,
    },
    fov: 76,
    ratio: 16 / 9,
  },
  upper: {
    position: [25.7, 5.99, -1.88],
    aim: {
      yaw: Math.PI / 2,
      pitch: 0,
    },
    fov: 70,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
