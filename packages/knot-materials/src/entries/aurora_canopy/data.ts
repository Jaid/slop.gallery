import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_canopy',
  candidateId: 'minimax',
  title: 'Aurora Canopy',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A silk so thin that the northern lights pass straight through it, leaving colours like wet paint in a breeze.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(176, 82, 52),
    shading: 'fabric',
  },
} as const satisfies KnotData
