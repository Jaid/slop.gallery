import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nocturne_glass',
  candidateId: 'deepseek',
  title: 'Nocturne Glass',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Rain writes on the glass all night, and behind every drop the city keeps burning out of focus.',
  placeholder: {
    color: hsl.integer(261, 44, 8),
    shading: 'glass',
  },
} as const satisfies KnotData
