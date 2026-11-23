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
  west_wing: {
    position: [-7.6, 1.6, 0],
    aim: {
      yaw: Math.PI,
      pitch: -0.1,
    },
    fov: 70,
    ratio: 16 / 9,
  },
  gallery: {
    position: [22, 6.2, 0],
    aim: {
      yaw: -Math.PI / 2,
      pitch: 0.05,
    },
    fov: 70,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
