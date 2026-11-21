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
  // Far down the link, looking north through a long lens at its barred gate, with the Lodge beyond.
  golf_gate: {
    position: [-28.316, 3.917, 30.236],
    aim: {
      yaw: 0.0069,
      pitch: -0.0768,
    },
    fov: 30,
    ratio: 16 / 9,
  },
  // Just over the cistern’s channel, looking north-north-east along its water through a long lens.
  water_drain: {
    position: [-22.665, 6.466, 5.607],
    aim: {
      yaw: -0.3691,
      pitch: -0.2268,
    },
    fov: 40,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
