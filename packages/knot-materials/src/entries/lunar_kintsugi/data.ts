import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MgSdUInR50wESrr; fixture: knot-material-shaders; result: success.
export default {
  id: 'lunar_kintsugi',
  candidateId: 'muse_wonder',
  title: 'Lunar Kintsugi',
  createdAt: 1_791_858_712,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'A broken moon, repaired with rivers of gold. The cracks are not hidden; they are the brightest geography the porcelain has ever known.',
  placeholder: {
    color: hsl.integer(87, 24, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
