import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'noctiluca',
  candidateId: 'deepseek',
  title: 'Noctiluca',
  createdAt: 1_789_075_137,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.016,
  flavorText: 'Every wave that breaks against your attention burns blue, then remembers nothing.',
  placeholder: {
    color: hsl.integer(232, 62, 11),
    shading: 'liquid',
  },
} as const satisfies KnotData
