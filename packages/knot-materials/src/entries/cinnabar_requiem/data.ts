import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K0nU326lufLQTl2; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'cinnabar_requiem',
  candidateId: 'space_bunny',
  title: 'Cinnabar Requiem',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Thirty coats of lacquer, each one left to cure for a week, until the wood underneath stopped existing.',
  placeholder: {
    color: hsl.integer(32, 99, 52),
    shading: 'smooth',
  },
} as const satisfies KnotData
