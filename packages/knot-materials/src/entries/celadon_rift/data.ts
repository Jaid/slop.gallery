import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'celadon_rift',
  candidateId: 'deepseek',
  title: 'Celadon Rift',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'It was broken, and rather than hide the fact it was given rivers of gold.',
  displacement: 0.004,
  placeholder: {
    color: hsl.integer(151, 28, 59),
    shading: 'smooth',
  },
} as const satisfies KnotData
