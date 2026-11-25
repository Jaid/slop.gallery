import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacreous_bloom',
  candidateId: 'deepseek',
  title: 'Nacreous Bloom',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Pale pearl opens like a flower beneath a changeable sky.',
  placeholder: {
    color: hsl.integer(339, 100, 84),
    shading: 'fabric',
  },
} as const satisfies KnotData
