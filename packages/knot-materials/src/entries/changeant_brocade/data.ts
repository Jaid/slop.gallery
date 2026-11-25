import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Cp16WUQoUlMTqRD; fixture: knot-material-shaders; result: success.
export default {
  id: 'changeant_brocade',
  candidateId: 'muse_wonder',
  title: 'Changeant Brocade',
  createdAt: 1_791_848_243,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Two threads argue in the light – teal where you stand, wine where you have just been, gold only for a glance.',
  placeholder: {
    color: hsl.integer(180, 15, 60),
    shading: 'fabric',
  },
} as const satisfies KnotData
