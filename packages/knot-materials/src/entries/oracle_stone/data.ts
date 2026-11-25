import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'oracle_stone',
  candidateId: 'gpt_terra',
  title: 'Oracle Stone',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Within charcoal stone, hidden crystal plates answer the eye with blue fire, cyan weather and impossible depth.',
  placeholder: {
    color: hsl.integer(224, 74, 20),
    shading: 'stone',
  },
} as const satisfies KnotData
