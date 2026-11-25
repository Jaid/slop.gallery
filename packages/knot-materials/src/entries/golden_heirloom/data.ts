import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AfC9LOF1p8reY9V; fixture: knot-material-shaders; result: success.
export default {
  id: 'golden_heirloom',
  candidateId: 'muse_wonder',
  title: 'Golden Heirloom',
  createdAt: 1_791_864_248,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Porcelain that broke and refused to hide it. Every scar is filled with gold, so the damage became the brightest part of the vessel.',
  placeholder: {
    color: hsl.integer(67, 17, 69),
    shading: 'smooth',
  },
} as const satisfies KnotData
