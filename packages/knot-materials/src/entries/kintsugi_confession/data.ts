import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_confession',
  candidateId: 'minimax',
  title: 'Kintsugi Confession',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A bowl the world refused, mended with a colour it cannot refuse.',
  placeholder: {
    color: hsl.integer(172, 22, 66),
    shading: 'smooth',
  },
} as const satisfies KnotData
