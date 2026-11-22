import type {RoomSpawn} from '../base/Room.ts'

export default {
  // Just inside the north entrance, looking south past the glass floor, 18° toward the east.
  '': {
    position: [-3, 0.04, -18.3],
    yaw: -0.9 * Math.PI,
    pitch: 0,
  },
  center: {
    position: [-5.8, 0.04, 6.2],
    yaw: -0.74,
    pitch: 0.03,
  },
} satisfies Record<string, RoomSpawn>
