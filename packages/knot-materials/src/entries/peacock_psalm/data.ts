import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Cp16WUQoUlMTqRD; fixture: knot-material-shaders; result: success.
export default {
  id: 'peacock_psalm',
  candidateId: 'muse_wonder',
  title: 'Peacock Psalm',
  createdAt: 1_791_848_243,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A hundred eyes open along one feathered body, and every eye changes its mind as you walk around it.',
  placeholder: {
    color: hsl.integer(201, 23, 48),
    shading: 'fabric',
  },
} as const satisfies KnotData
