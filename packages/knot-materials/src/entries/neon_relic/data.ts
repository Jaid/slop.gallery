import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K0nU326lufLQTl2; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'neon_relic',
  candidateId: 'space_bunny',
  title: 'Neon Relic',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Cold cathode, warm glass: the gas remembers the current that made it, and the tube hums a note nobody can hear.',
  placeholder: {
    color: hsl.integer(10, 100, 59),
    shading: 'glass',
  },
} as const satisfies KnotData
