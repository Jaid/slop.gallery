import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2b7SAOfgKTVu0qb; fixture: knot-material-shaders; result: success.
export default {
  id: 'quicksilver_dew',
  candidateId: 'muse_wonder',
  title: 'Quicksilver Dew',
  createdAt: 1_791_848_912,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.012,
  flavorText: 'A tide of living mercury, forever arriving and never still; its mirror ripples toward every step you take.',
  placeholder: {
    color: hsl.integer(223, 4, 66),
    shading: 'liquid',
  },
} as const satisfies KnotData
