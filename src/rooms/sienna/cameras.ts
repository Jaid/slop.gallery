import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [4.86, 1.07, -5.6],
    aim: {
      yaw: 2.44,
      pitch: 0.13,
    },
    fov: 65,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
