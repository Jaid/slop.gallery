import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: D2pmfQp7iycRJKh; fixture: knot-material-shaders; result: success.
export default {
  id: 'morpho_vow',
  candidateId: 'muse_wonder',
  title: 'Morpho Vow',
  createdAt: 1_791_886_417,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ten thousand blue scales keep a wing’s old promise: color is not worn, it is agreed upon by light, tilt and witness.',
  placeholder: {
    color: hsl.integer(263, 88, 30),
    shading: 'glass',
  },
} as const satisfies KnotData
