import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cartographers_eclipse',
  candidateId: 'minimax',
  title: 'Cartographer\'s Eclipse',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A pocket universe folded into bronze: the whole sky at the moment you stopped looking up.',
  placeholder: {
    color: hsl.integer(265, 37, 11),
    shading: 'metal',
  },
} as const satisfies KnotData
