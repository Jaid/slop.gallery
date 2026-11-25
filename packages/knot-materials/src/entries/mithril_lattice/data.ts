import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mithril_lattice',
  candidateId: 'minimax',
  title: 'Mithril Lattice',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A thousand rings of moonlight drawn into one quiet chain. None of them remember who wove them.',
  displacement: 0.003,
  placeholder: {
    color: hsl.integer(253, 12, 74),
    shading: 'metal',
  },
} as const satisfies KnotData
