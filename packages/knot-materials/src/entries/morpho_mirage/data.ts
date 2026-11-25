import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MgSdUInR50wESrr; fixture: knot-material-shaders; result: success.
export default {
  id: 'morpho_mirage',
  candidateId: 'muse_wonder',
  title: 'Morpho Mirage',
  createdAt: 1_791_858_712,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'A thousand butterfly wings share one knot. Their blue is not pigment but light, returned only to the eye that moves to earn it.',
  placeholder: {
    color: hsl.integer(258, 89, 30),
    shading: 'glass',
  },
} as const satisfies KnotData
