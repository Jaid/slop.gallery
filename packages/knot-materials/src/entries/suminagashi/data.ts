import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'suminagashi',
  candidateId: 'deepseek',
  title: 'Suminagashi',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Ink was dropped on still water, and the water was asked to remember it.',
  placeholder: {
    color: hsl.integer(86, 15, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
