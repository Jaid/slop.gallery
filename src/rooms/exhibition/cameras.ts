import type {RoomCamera} from '../base/Room.ts'

export default {
  // At the tunnel’s north end, looking south-west and down the beveled gallery between the displays.
  overview: {
    position: [4.498, 1.685, -6.5],
    aim: {
      yaw: 2.6141,
      pitch: -0.3216,
    },
    fov: 90,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
