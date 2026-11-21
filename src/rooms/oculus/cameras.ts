import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-8.106, 8.572, 5.611],
    aim: {
      yaw: -0.9331,
      pitch: -0.4196,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  balcony: {
    position: [-6.448, 8.014, -9.632],
    aim: {
      yaw: -2.7851,
      pitch: -0.262,
    },
    fov: 55,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
