import type {RoomCamera} from '../base/Room.ts'

export default {
  // From the north-west aisle, looking along the bowstring trusses toward the alchemy bench.
  overview: {
    position: [-1.9, 1.54, -6.6],
    aim: {
      yaw: 2.9147,
      pitch: 0.2443,
    },
    fov: 83,
    ratio: 16 / 9,
  },
  // From the workshop through the north arch, toward the vestibule and the Bastion.
  vestibule: {
    position: [0, 1.6, -6.6],
    aim: {
      yaw: 0,
      pitch: 0.21,
    },
    fov: 90,
    ratio: 16 / 9,
  },
  // Looking up at the cupola and its opal pendant from beside the cistern window.
  cupola: {
    position: [-0.8, 1.7, -13.25],
    aim: {
      yaw: -2.8449,
      pitch: 0.7156,
    },
    fov: 85,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
