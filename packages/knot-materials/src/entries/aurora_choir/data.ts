import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_choir',
  candidateId: 'gpt_sol',
  title: 'Aurora Choir',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'Every ribbon sings a different color into the polar silence.',
  placeholder: {
    color: hsl.integer(171.3, 100, 89),
    shading: 'smooth',
  },
} as const satisfies KnotData
