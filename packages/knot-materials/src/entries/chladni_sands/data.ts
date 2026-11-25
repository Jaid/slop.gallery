import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chladni_sands',
  candidateId: 'gpt_astra',
  title: 'Chladni Sands',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'The sand changes its mind whenever the hidden note changes pitch.',
  placeholder: {
    color: hsl.integer(90, 54, 87),
    shading: 'smooth',
  },
} as const satisfies KnotData
