import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [4.86, 1.65, -5.2],
    aim: {
      yaw: 2.35,
      pitch: 0.13,
    },
    fov: 65,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
