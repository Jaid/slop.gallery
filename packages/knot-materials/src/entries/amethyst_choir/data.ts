import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Cp16WUQoUlMTqRD; fixture: knot-material-shaders; result: success.
export default {
  id: 'amethyst_choir',
  candidateId: 'muse_wonder',
  title: 'Amethyst Choir',
  createdAt: 1_791_848_243,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.01,
  flavorText: 'A hundred violet throats are cut into one stone; each turns its own cold note toward the light that finds it.',
  placeholder: {
    color: hsl.integer(302, 35, 57),
    shading: 'glass',
  },
} as const satisfies KnotData
