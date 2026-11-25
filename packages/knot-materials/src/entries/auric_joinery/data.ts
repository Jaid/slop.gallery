import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'auric_joinery',
  candidateId: 'deepseek',
  title: 'Auric Joinery',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The break was never hidden – it was filled with gold, and the bowl became worth more than before.',
  placeholder: {
    color: hsl.integer(81, 29, 42),
    shading: 'stone',
  },
} as const satisfies KnotData
