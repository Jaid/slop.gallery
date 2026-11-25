import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'confetti_terrazzo',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  title: 'Confetti Terrazzo',
  createdAt: 1_789_816_097,
  flavorText: 'The workshop swept its brightest offcuts into one stone and polished the celebration smooth.',
  placeholder: {
    color: hsl.integer(73, 37, 83),
    shading: 'stone',
  },
} as const satisfies KnotData
