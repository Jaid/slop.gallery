import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'holographic_chrysalis',
  candidateId: 'minimax',
  title: 'Holographic Chrysalis',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiniMax M3',
      slug: 'minimax/minimax-m3',
    },
  },
  flavorText: 'A thousand microscopic scales whisper the same bright lie about colour, and the lie changes whenever you move.',
  displacement: 0.003,
  placeholder: {
    color: hsl.integer(265, 89, 44),
    shading: 'glass',
  },
} as const satisfies KnotData
