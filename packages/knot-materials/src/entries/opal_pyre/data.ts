import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opal_pyre',
  candidateId: 'minimax',
  title: 'Opal Pyre',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A fire frozen in silica. The colours come from somewhere inside, and never the same colour twice.',
  placeholder: {
    color: hsl.integer(37, 77, 56),
    shading: 'glass',
  },
} as const satisfies KnotData
