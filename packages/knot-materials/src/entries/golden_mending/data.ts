import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2b7SAOfgKTVu0qb; fixture: knot-material-shaders; result: success.
export default {
  id: 'golden_mending',
  candidateId: 'muse_wonder',
  title: 'Golden Mending',
  createdAt: 1_791_848_912,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Broken porcelain remembers every fracture in gold, and the seams flare only when your gaze crosses them.',
  placeholder: {
    color: hsl.integer(96, 14, 81),
    shading: 'smooth',
  },
} as const satisfies KnotData
