import type {RoomCamera} from '../base/Room.ts'

export default {
  // At the tunnel’s high south threshold in Moonfall, looking north-east down the beveled gallery between the displays.
  overview: {
    position: [-4, 3.1, 9.55],
    aim: {
      yaw: -0.25,
      pitch: -0.05,
    },
    fov: 80,
    ratio: 16 / 9,
  },
} satisfies Record<string, RoomCamera>
