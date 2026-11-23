import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-3.645, 1.154, 2.547],
    aim: {
      yaw: -1.0839,
      pitch: 0.4332,
    },
    fov: 100,
    ratio: 16 / 9,
  },
  west: {
    position: [-2.2, 1.7, -2],
    aim: {
      yaw: Math.PI / 2,
      pitch: 0.05,
    },
    fov: 75,
    ratio: 16 / 9,
  },
  east: {
    position: [6.8, 1.7, -1],
    aim: {
      yaw: -Math.PI / 2,
      pitch: 0.14,
    },
    fov: 75,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
