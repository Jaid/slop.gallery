import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'comet_impasto',
  candidateId: 'space_bunny',
  title: 'Comet Impasto',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A storm of pigment keeps its memories in every raised brushstroke.',
  placeholder: {
    color: hsl.integer(268, 91, 35),
    shading: 'smooth',
  },
  displacement: 0.005,
} as const satisfies KnotData
