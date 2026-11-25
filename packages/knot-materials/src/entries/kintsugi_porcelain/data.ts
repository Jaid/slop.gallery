import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KsUDOPCUWqzzKMp; fixture: knot-material-shaders; result: success.
export default {
  id: 'kintsugi_porcelain',
  candidateId: 'muse_wonder',
  title: 'Kintsugi Porcelain',
  createdAt: 1_791_854_180,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ivory porcelain remembers every fracture, and each wound is taught to shine in gold.',
  placeholder: {
    color: hsl.integer(85, 24, 86.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
