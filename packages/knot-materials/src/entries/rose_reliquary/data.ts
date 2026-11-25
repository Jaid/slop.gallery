import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KsUDOPCUWqzzKMp; fixture: knot-material-shaders; result: success.
export default {
  id: 'rose_reliquary',
  candidateId: 'muse_wonder',
  title: 'Rose Reliquary',
  createdAt: 1_791_854_180,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'A cathedral rose folded into a knot, its jewel panes lit by a sun that circles forever inside the glass.',
  placeholder: {
    color: hsl.integer(350, 79, 31),
    shading: 'glass',
  },
} as const satisfies KnotData
