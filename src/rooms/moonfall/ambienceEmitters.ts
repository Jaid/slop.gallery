import type {RoomAmbience} from '../base/Room.ts'

import {moonfallSculpture} from '#src/lib/gallery/moonfall/sculpture.ts'

export default {
  // A celestial hum from the orbital sculpture’s core.
  orbital_sculpture: {
    emitter: 'hum',
    position: moonfallSculpture.center,
  },
} satisfies Record<string, RoomAmbience>
