import type {RoomCamera} from '../base/Room.ts'

export default {
  // High by the west wall, south of the middle, looking east and down across the room.
  overview: {
    position: [-5.856, 3.73, 3.957],
    aim: {
      yaw: -1.2131,
      pitch: -0.3176,
    },
    fov: 80,
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
  // From the middle of the room at eye height, looking due south through a long lens at the alchemy machine before the south wall.
  alchemy_table: {
    position: [0, 1.5, 0.818],
    aim: {
      yaw: Math.PI,
      pitch: -0.0308,
    },
    fov: 30,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
