import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: EC58pRKjMMMNqsv; fixture: knot-material-shaders; result: success.
export default {
  id: 'midnight_jacquard',
  candidateId: 'muse_wonder',
  title: 'Midnight Jacquard',
  createdAt: 1_791_844_628,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Silk woven in darkness, its damask blooms only for light that arrives at a slant – and the gold remembers every glance.',
  placeholder: {
    color: hsl.integer(319, 24, 27),
    shading: 'fabric',
  },
} as const satisfies KnotData
