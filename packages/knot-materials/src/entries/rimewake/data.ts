import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'rimewake',
  candidateId: 'space_bunny',
  title: 'Rimewake',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.01,
  flavorText: 'Cold found the iron first and has been writing on it all night, in a script that melts the moment you look away.',
  placeholder: {
    color: hsl.integer(241, 30, 77),
    shading: 'metal',
  },
} as const satisfies KnotData
