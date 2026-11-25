import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AfC9LOF1p8reY9V; fixture: knot-material-shaders; result: success.
export default {
  id: 'labradorescence',
  candidateId: 'muse_wonder',
  title: 'Labradorescence',
  createdAt: 1_791_864_248,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'A dark stone that keeps an aurora in its grains. Only when eye, light and lamellae agree does a grain ignite, then go black again.',
  placeholder: {
    color: hsl.integer(247, 38, 14),
    shading: 'stone',
  },
} as const satisfies KnotData
