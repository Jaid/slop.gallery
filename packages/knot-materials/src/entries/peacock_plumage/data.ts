import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KsUDOPCUWqzzKMp; fixture: knot-material-shaders; result: success.
export default {
  id: 'peacock_plumage',
  candidateId: 'muse_wonder',
  title: 'Peacock Plumage',
  createdAt: 1_791_854_180,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'A hundred emerald eyes open along the feather, each one watching the light that watches you.',
  placeholder: {
    color: hsl.integer(240, 79, 23),
    shading: 'fabric',
  },
} as const satisfies KnotData
