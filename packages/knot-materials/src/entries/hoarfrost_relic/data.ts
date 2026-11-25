import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KsUDOPCUWqzzKMp; fixture: knot-material-shaders; result: success.
export default {
  id: 'hoarfrost_relic',
  candidateId: 'muse_wonder',
  title: 'Hoarfrost Relic',
  createdAt: 1_791_854_180,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.012,
  flavorText: 'Night stone exhales winter; white branches creep over it, waiting for a nearer gaze to glitter.',
  placeholder: {
    color: hsl.integer(208, 45, 88),
    shading: 'glass',
  },
} as const satisfies KnotData
