import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opaline',
  candidateId: 'deepseek',
  title: 'Opaline',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A million silica spheres vote on which colour the light should be today.',
  placeholder: {
    color: hsl.integer(75, 6, 85),
    shading: 'glass',
  },
} as const satisfies KnotData
