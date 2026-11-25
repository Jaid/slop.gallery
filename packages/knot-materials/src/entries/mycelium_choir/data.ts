import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelium_choir',
  candidateId: 'grok',
  title: 'Mycelium Choir',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A thousand quiet filaments pass the same bright note from branch to branch.',
  placeholder: {
    color: hsl.integer(157, 100, 88.4),
    shading: 'fabric',
  },
} as const satisfies KnotData
