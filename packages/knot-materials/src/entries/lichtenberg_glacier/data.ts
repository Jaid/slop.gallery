import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lichtenberg_glacier',
  candidateId: 'minimax',
  title: 'Lichtenberg Glacier',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A millionth of a second of lightning, kept forever in cold glass.',
  placeholder: {
    color: hsl.integer(250, 65, 25),
    shading: 'glass',
  },
} as const satisfies KnotData
