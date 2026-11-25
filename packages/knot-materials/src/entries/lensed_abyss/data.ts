import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lensed_abyss',
  candidateId: 'deepseek',
  title: 'Lensed Abyss',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Light arrives, is thanked for its service and is never seen again.',
  placeholder: {
    color: hsl.integer(318, 24, 9),
    shading: 'smooth',
  },
} as const satisfies KnotData
