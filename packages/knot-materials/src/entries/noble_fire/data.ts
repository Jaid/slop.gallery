import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'noble_fire',
  candidateId: 'deepseek',
  title: 'Noble Fire',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A black stone keeps a thousand small fires, and lets you see only the ones you deserve.',
  placeholder: {
    color: hsl.integer(336, 13, 17),
    shading: 'glass',
  },
} as const satisfies KnotData
