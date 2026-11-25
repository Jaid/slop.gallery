import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_veil',
  candidateId: 'deepseek',
  title: 'Aurora Veil',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'The night draws a translucent curtain across its distant fires.',
  placeholder: {
    color: hsl.integer(167, 100, 89.9),
    shading: 'glass',
  },
} as const satisfies KnotData
