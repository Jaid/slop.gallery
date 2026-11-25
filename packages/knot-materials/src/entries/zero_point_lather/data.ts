import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'zero_point_lather',
  candidateId: 'deepseek',
  title: 'Quantum Foam',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'At the edge of stillness, a fine froth refuses to settle into nothing.',
  placeholder: {
    color: hsl.integer(297, 100, 68),
    shading: 'smooth',
  },
} as const satisfies KnotData
