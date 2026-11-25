import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K0nU326lufLQTl2; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'strata',
  candidateId: 'space_bunny',
  title: 'Strata',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Two hundred million years of water, patient as a knife, laying down one red summer at a time.',
  placeholder: {
    color: hsl.integer(51, 99, 74),
    shading: 'stone',
  },
} as const satisfies KnotData
