import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'emberwake',
  candidateId: 'deepseek',
  title: 'Emberwake',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The stone is only a lid. Underneath it, something still remembers being molten and lifts the light to its seams.',
  placeholder: {
    color: hsl.integer(75, 10, 13),
    shading: 'stone',
  },
} as const satisfies KnotData
