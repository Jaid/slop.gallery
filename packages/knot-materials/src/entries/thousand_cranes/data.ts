import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'thousand_cranes',
  candidateId: 'deepseek',
  title: 'Thousand Cranes',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.03,
  flavorText: 'Fold a bird for every year of a stranger’s life, and the paper learns to hold a flock.',
  placeholder: {
    color: hsl.integer(86, 17, 38),
    shading: 'smooth',
  },
} as const satisfies KnotData
