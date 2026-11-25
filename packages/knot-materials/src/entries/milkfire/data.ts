import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0gaFob3tIS0Bvlc; fixture: knot-material-shaders; result: success.
export default {
  id: 'milkfire',
  candidateId: 'muse_wonder',
  title: 'Milkfire',
  createdAt: 1_791_844_380,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'high',
    },
  },
  flavorText: 'A white stone keeps a weather of tiny fires. Each step you take wakes another color and puts the last one quietly to sleep.',
  placeholder: {
    color: hsl.integer(17, 10, 90),
    shading: 'smooth',
  },
} as const satisfies KnotData
