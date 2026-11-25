import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'cilia',
  candidateId: 'space_bunny',
  title: 'Cilia',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.0025,
  flavorText: 'Eight rows of comb plates beat in time, and every one of them is a prism small enough to argue with a rainbow.',
  placeholder: {
    color: hsl.integer(212, 53, 47),
    shading: 'glass',
  },
} as const satisfies KnotData
