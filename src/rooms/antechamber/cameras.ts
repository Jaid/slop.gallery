import type {RoomCamera} from '../base/Room.ts'

export default {
  lunar: {
    position: [4.6, 2.35, -2.05],
    aim: {
      yaw: -2.12,
      pitch: -0.07,
    },
    fov: 78,
    ratio: 16 / 9,
  },
  solar: {
    position: [-4.6, 2.35, -2.3],
    aim: {
      yaw: 2.6,
      pitch: -0.08,
    },
    fov: 81,
    ratio: 16 / 9,
  },
  overview: {
    position: [-3.645, 1.154, 2.547],
    aim: {
      yaw: -1.0839,
      pitch: 0.4332,
    },
    fov: 100,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
