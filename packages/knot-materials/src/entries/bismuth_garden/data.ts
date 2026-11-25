import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_garden',
  candidateId: 'gpt_terra',
  title: 'Bismuth Garden',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Impossible crystal terraces have climbed the knot overnight, growing a different rainbow on every edge.',
  placeholder: {
    color: hsl.integer(307, 32, 59),
    shading: 'metal',
  },
} as const satisfies KnotData
