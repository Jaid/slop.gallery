import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solenoid',
  candidateId: 'deepseek',
  title: 'Solenoid',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Wind a mile of copper around a prayer and let the current sing.',
  displacement: 0.009,
  placeholder: {
    color: hsl.integer(51, 72, 48),
    shading: 'metal',
  },
} as const satisfies KnotData
