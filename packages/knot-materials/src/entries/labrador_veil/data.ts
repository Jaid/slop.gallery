import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'labrador_veil',
  candidateId: 'deepseek',
  title: 'Labrador Veil',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A stone that keeps the northern lights asleep inside its cleavage planes.',
  displacement: 0.0006,
  placeholder: {
    color: hsl.integer(246, 44, 28),
    shading: 'stone',
  },
} as const satisfies KnotData
