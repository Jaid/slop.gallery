import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'reticle',
  candidateId: 'space_bunny',
  title: 'Reticle',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.002,
  flavorText: 'A city laid out for electrons, seen from above at the exact magnification where the streets become logic.',
  placeholder: {
    color: hsl.integer(263, 32, 61),
    shading: 'metal',
  },
} as const satisfies KnotData
