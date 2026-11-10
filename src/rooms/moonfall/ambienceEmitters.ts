import type {RoomAmbience} from '../base/Room.ts'

export default {
  // A celestial hum from the orbital sculpture’s core.
  orbital_sculpture: {
    emitter: 'hum',
    position: [0, 2.5, 0],
  },
} satisfies Record<string, RoomAmbience>
