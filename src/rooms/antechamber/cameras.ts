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
} satisfies Record<string, RoomCamera>
