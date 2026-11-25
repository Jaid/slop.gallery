import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Am1BnNRHvHbHCa2; fixture: knot-material-shaders; result: success.
export default {
  id: 'gilded_loom',
  candidateId: 'muse_wonder',
  title: 'Gilded Loom',
  createdAt: 1_791_867_537,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Indigo velvet and antique gold, woven so finely that the pattern only finishes itself inside a moving eye.',
  placeholder: {
    color: hsl.integer(280, 61, 17),
    shading: 'fabric',
  },
} as const satisfies KnotData
