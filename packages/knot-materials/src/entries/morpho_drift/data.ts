import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Am1BnNRHvHbHCa2; fixture: knot-material-shaders; result: success.
export default {
  id: 'morpho_drift',
  candidateId: 'muse_wonder',
  title: 'Morpho Drift',
  createdAt: 1_791_867_537,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.024,
  flavorText: 'A thousand blue wings folded into a single knot; none of them holds any blue, yet every step you take sets them flying.',
  placeholder: {
    color: hsl.integer(260, 89, 36),
    shading: 'glass',
  },
} as const satisfies KnotData
