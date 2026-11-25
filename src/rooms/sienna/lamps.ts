import type {Lamp} from '../base/Room.ts'

import hsl from 'okhsl'

import {chandelierLampY} from '#src/lib/physics/chandelier.ts'

export default {
  // Below the swinging chandelier’s metalwork at rest, so the fixture can’t shadow its own source; it swings along with it.
  chandelier: {
    position: [0, chandelierLampY, 0],
    strength: 110,
    tint: hsl.integer(86, 100, 86.5),
    range: 15,
    decay: 1.75,
    shadow: true,
  },
} satisfies Record<string, Lamp>
