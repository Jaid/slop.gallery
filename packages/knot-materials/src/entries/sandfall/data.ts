import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sandfall',
  candidateId: 'deepseek',
  title: 'Sandfall',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The dune has been walking for ten thousand years and will not answer to anything but wind and patience.',
  placeholder: {
    color: hsl.integer(82, 45, 56),
    shading: 'stone',
  },
} as const satisfies KnotData
