import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gilded_fracture',
  candidateId: 'deepseek',
  title: 'Gilded Fracture',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Broken once, and mended by someone who believed the cracks deserved gold.',
  placeholder: {
    color: hsl.integer(172, 78, 42),
    shading: 'stone',
  },
} as const satisfies KnotData
