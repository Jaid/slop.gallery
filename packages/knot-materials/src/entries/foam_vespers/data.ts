import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'foam_vespers',
  candidateId: 'deepseek',
  title: 'Foam Vespers',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.017,
  flavorText: 'Every film is a small closed world that drains until it forgets color, then fills its lungs and begins the rainbow again.',
  placeholder: {
    color: hsl.integer(246, 100, 90.7),
    shading: 'glass',
  },
} as const satisfies KnotData
