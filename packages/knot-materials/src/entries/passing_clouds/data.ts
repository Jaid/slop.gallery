import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AfC9LOF1p8reY9V; fixture: knot-material-shaders; result: success.
export default {
  id: 'passing_clouds',
  candidateId: 'muse_wonder',
  title: 'Passing Clouds',
  createdAt: 1_791_864_248,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.008,
  flavorText: 'It thinks in color. Pigment cells breathe and bloom beneath wet skin, and the closer you lean, the brighter its warning burns.',
  placeholder: {
    color: hsl.integer(161, 50, 72),
    shading: 'liquid',
  },
} as const satisfies KnotData
