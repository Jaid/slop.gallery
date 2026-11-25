import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: EC58pRKjMMMNqsv; fixture: knot-material-shaders; result: success.
export default {
  id: 'pyre_heart',
  candidateId: 'muse_wonder',
  title: 'Pyre Heart',
  createdAt: 1_791_844_628,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Charred stone split by living fire; the cracks breathe, brighten at your approach and cool behind your back.',
  placeholder: {
    color: hsl.integer(50, 28, 31),
    shading: 'stone',
  },
} as const satisfies KnotData
