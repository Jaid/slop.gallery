import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hoarfrost_hymn',
  candidateId: 'deepseek',
  title: 'Hoarfrost Hymn',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Winter sings one note at a time, and the ice writes down what it hears.',
  placeholder: {
    color: hsl.integer(253, 100, 67.4),
    shading: 'glass',
  },
} as const satisfies KnotData
