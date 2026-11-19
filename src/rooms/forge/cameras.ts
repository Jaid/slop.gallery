import type {RoomCamera} from '../base/Room.ts'

export default {
  // From the north-east corner, looking south-west across the tables and the sunlit floor under the sawtooth roof toward the alchemy machine at the south wall.
  overview: {
    position: [2.646, 2.856, -7.442],
    aim: {
      yaw: 3.0385,
      pitch: -0.2872,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  // Before the north wall’s arch, looking up through it into the round vestibule, at its brick dome and its arch onto the Bastion’s approach.
  vestibule: {
    position: [0, 1.6, -6.6],
    aim: {
      yaw: 0,
      pitch: 0.21,
    },
    fov: 90,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
