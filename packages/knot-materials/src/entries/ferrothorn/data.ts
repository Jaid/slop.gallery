import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferrothorn',
  candidateId: 'gpt_astra',
  title: 'Ferrothorn',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A polished wilderness of thorns follows the lines of an invisible field.',
  placeholder: {
    color: hsl.integer(223, 25, 72),
    shading: 'metal',
  },
  displacement: 0.048,
} as const satisfies KnotData
