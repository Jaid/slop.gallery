import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'folded_silence',
  candidateId: 'gpt_astra',
  title: 'Folded Silence',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Every crease is a place where an unspoken thought has settled.',
  placeholder: {
    color: hsl.integer(86, 36, 89),
    shading: 'smooth',
  },
  displacement: 0.048,
} as const satisfies KnotData
