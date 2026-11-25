import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'pelagic_reply',
  candidateId: 'deepseek',
  title: 'Pelagic Reply',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Four kilometres down, something notices the light and decides to answer.',
  placeholder: {
    color: hsl.integer(220, 80, 36),
    shading: 'glass',
  },
} as const satisfies KnotData
