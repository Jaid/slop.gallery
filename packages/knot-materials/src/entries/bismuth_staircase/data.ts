import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_staircase',
  candidateId: 'deepseek',
  title: 'Bismuth Staircase',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The metal refused to grow smoothly, and stacked its own rainbow instead.',
  displacement: 0.15,
  placeholder: {
    color: hsl.integer(301, 53, 59),
    shading: 'metal',
  },
} as const satisfies KnotData
