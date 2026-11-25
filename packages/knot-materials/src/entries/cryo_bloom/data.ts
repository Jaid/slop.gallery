import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cryo_bloom',
  candidateId: 'deepseek',
  title: 'Cryo Bloom',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Frost opens its delicate petals before the warmth can find them.',
  placeholder: {
    color: hsl.integer(203, 99, 89.6),
    shading: 'fabric',
  },
} as const satisfies KnotData
