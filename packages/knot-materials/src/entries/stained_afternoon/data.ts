import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'stained_afternoon',
  candidateId: 'deepseek',
  title: 'Stained Afternoon',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A thousand small windows hold the afternoon and refuse to let it go.',
  displacement: 0.0026,
  placeholder: {
    color: hsl.integer(357, 55, 35),
    shading: 'glass',
  },
} as const satisfies KnotData
