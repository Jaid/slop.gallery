import type {RoomCamera} from '../base/Room.ts'

export default {
  // High in the curve’s west end, looking south-east and down toward the apse.
  overview: {
    position: [-8.597, 3.497, -1.037],
    aim: {
      yaw: -2.5551,
      pitch: -0.4176,
    },
    fov: 85,
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
  // Farther back in the same blind branch, looking north down it through a long lens past its barred window.
  knight_alley: {
    position: [-16.952, 2.202, 16.145],
    aim: {
      yaw: -0.0319,
      pitch: -0.0228,
    },
    fov: 30,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
