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
  // From the middle of the west wing, down the gallery to the head of the stairs.
  gallery: {
    position: [-8, 1.7, -2.6],
    aim: {
      yaw: Math.PI,
      pitch: -0.04,
    },
    fov: 60,
    ratio: 16 / 9,
  },
  // From the west wing’s doorway, east through the middle and the east wing up the flight.
  axis: {
    position: [-4.6, 1.7, 0],
    aim: {
      yaw: -Math.PI / 2,
      pitch: 0.06,
    },
    fov: 60,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
