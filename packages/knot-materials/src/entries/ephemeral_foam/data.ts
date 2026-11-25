import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ephemeral_foam',
  candidateId: 'gpt_astra',
  title: 'Ephemeral Assembly',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Each fragile chamber is a small promise the next moment may erase.',
  placeholder: {
    color: hsl.integer(182, 59, 87),
    shading: 'liquid',
  },
} as const satisfies KnotData
