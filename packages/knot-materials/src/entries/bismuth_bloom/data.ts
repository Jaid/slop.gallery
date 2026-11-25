import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_bloom',
  candidateId: 'minimax',
  title: 'Bismuth Bloom',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'Molten bismuth forgets itself in stepped terraces of oxide colour, each landing a different temperature of rainbow.',
  displacement: 0.009,
  placeholder: {
    color: hsl.integer(325, 55, 58),
    shading: 'metal',
  },
} as const satisfies KnotData
