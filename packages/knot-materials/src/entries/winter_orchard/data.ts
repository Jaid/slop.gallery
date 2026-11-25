import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'winter_orchard',
  candidateId: 'gpt_astra',
  title: 'Winter Orchard',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Beneath blue ice, a garden grows in six directions at once. Its pale branches drink the warmth of your passing.',
  placeholder: {
    color: hsl.integer(228, 39, 69),
    shading: 'glass',
  },
} as const satisfies KnotData
