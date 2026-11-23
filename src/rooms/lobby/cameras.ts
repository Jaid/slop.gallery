import type {RoomCamera} from '../base/Room.ts'

export default {
  overview: {
    position: [-3.798, 4.067, -19.342],
    aim: {
      yaw: -2.8403,
      pitch: -0.2336,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  loggia: {
    position: [-6, 6, 9],
    aim: {
      yaw: -2.7053,
      pitch: -0.0873,
    },
    fov: 64,
    ratio: 16 / 9,
  },
  balcony: {
    position: [6.4, 6, 19.5],
    aim: {
      yaw: 0.58,
      pitch: -0.22,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  floor: {
    position: [-6.13, 0.9, 19.29],
    aim: {
      yaw: -0.46,
      pitch: 0.05,
    },
    fov: 75,
    ratio: 16 / 9,
  },
  chandeliers: {
    position: [-2.929, 7.842, -8.882],
    aim: {
      yaw: -2.196,
      pitch: 0.3312,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  fountain: {
    position: [-7.693, 2.4, -1.583],
    aim: {
      yaw: -1.7942,
      pitch: -0.0196,
    },
    fov: 50,
    ratio: 1,
  },
} satisfies Record<string, RoomCamera>
