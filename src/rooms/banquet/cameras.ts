import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [5.096, 3.724, 11.698],
    aim: {
      yaw: 0.6857,
      pitch: -0.2136,
    },
    fov: 70,
    ratio: 16 / 9,
  },
  floor: {
    position: [-3.39, 0.58, 11.24],
    aim: {
      yaw: 0.15,
      pitch: -0.03,
    },
    fov: 50,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
