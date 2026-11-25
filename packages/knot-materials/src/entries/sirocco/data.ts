import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'sirocco',
  candidateId: 'space_bunny',
  title: 'Sirocco',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.006,
  flavorText: 'For ten thousand years the wind has been writing the same sentence over and over, and the desert has never once objected.',
  placeholder: {
    color: hsl.integer(74, 62, 64),
    shading: 'stone',
  },
} as const satisfies KnotData
