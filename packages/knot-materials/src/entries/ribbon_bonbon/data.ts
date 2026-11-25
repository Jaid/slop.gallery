import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ribbon_bonbon',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  title: 'Ribbon Bonbon',
  createdAt: 1_789_816_097,
  flavorText: 'Strawberry and mint follow six sugar flutes around a confection with no first bite.',
  displacement: 0.02,
  placeholder: {
    color: hsl.integer(11, 86, 57),
    shading: 'liquid',
  },
} as const satisfies KnotData
