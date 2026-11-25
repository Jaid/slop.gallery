import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: EC58pRKjMMMNqsv; fixture: knot-material-shaders; result: success.
export default {
  id: 'resin_nebula',
  candidateId: 'muse_wonder',
  title: 'Resin Nebula',
  createdAt: 1_791_844_628,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A nebula folded into clear resin; lean closer and its star clouds drift past one another, refusing to sit still.',
  placeholder: {
    color: hsl.integer(288, 29, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
