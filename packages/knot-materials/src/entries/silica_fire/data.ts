import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'silica_fire',
  candidateId: 'deepseek',
  title: 'Silica Fire',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A million silica spheres agree to disagree about the color of the light.',
  displacement: 0.0004,
  placeholder: {
    color: hsl.integer(243, 15, 79),
    shading: 'glass',
  },
} as const satisfies KnotData
