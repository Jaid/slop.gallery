import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'horologists_paradox',
  candidateId: 'gpt_astra',
  title: "Horologist's Paradox",
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Every gear agrees on the hour; none agree on which way time moves.',
  placeholder: {
    color: hsl.integer(81, 61, 75),
    shading: 'smooth',
  },
} as const satisfies KnotData
