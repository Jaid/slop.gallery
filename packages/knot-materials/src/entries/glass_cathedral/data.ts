import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Cp16WUQoUlMTqRD; fixture: knot-material-shaders; result: success.
export default {
  id: 'glass_cathedral',
  candidateId: 'muse_wonder',
  title: 'Glass Cathedral',
  createdAt: 1_791_848_243,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Small windows, borrowed from midnight mass, bend their jewel light around a knot no mason could build.',
  placeholder: {
    color: hsl.integer(347, 27, 54),
    shading: 'glass',
  },
} as const satisfies KnotData
