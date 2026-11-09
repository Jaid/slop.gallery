import type {RoomCamera} from '../base/Room.ts'

export default {
  // Where the curve leaves the apse’s east shoulder, looking west along its crown past the barred gate toward the lanterns.
  overview: {
    position: [6.2, 1.7, -0.1],
    aim: {
      yaw: 1.66,
      pitch: 0.07,
    },
    fov: 75,
    ratio: 16 / 9,
  },
  // In the mouth of the blind branch beside the Lodge, looking down it at the empty suit of armor at its end with the helmet on its shoulders.
  armor: {
    position: [-16.4, 2.55, 11.9],
    aim: {
      yaw: 0.115,
      pitch: -0.05,
    },
    fov: 60,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
