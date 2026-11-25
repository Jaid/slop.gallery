import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelial_bloom',
  candidateId: 'deepseek',
  title: 'Mycelial Bloom',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Beneath the bark a pale intelligence is mapping the dark, one thread at a time.',
  displacement: 0.012,
  placeholder: {
    color: hsl.integer(127, 43, 37),
    shading: 'stone',
  },
} as const satisfies KnotData
