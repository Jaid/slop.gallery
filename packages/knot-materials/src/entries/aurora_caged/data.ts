import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_caged',
  candidateId: 'deepseek',
  title: 'Aurora Caged',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A wandering sky has learned the shape of a vessel.',
  placeholder: {
    color: hsl.integer(155, 99, 89),
    shading: 'smooth',
  },
} as const satisfies KnotData
