import type {RoomCamera} from '../base/Room.ts'

export default {
  // From the north-east corner, looking south-west across the worktables under the sawtooth lights toward the south wall.
  overview: {
    position: [2.65, 1.6, -6.9],
    aim: {
      yaw: 2.9147,
      pitch: 0.2269,
    },
    fov: 73,
    ratio: 16 / 9,
  },
  // From the middle of the vestibule, knee-high, looking south through the arch down the aisle to the alchemy machine.
  threshold: {
    position: [0.687, 0.724, -10.921],
    aim: {
      yaw: 2.8476,
      pitch: 0.1284,
    },
    fov: 62,
    ratio: 16 / 9,
  },
  // Before the north wall’s arch, looking up through it into the round vestibule, at its glazed hood and its arch onto the Bastion’s approach.
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
