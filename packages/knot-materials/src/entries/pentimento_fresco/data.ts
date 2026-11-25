import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'pentimento_fresco',
  candidateId: 'gpt_sol',
  title: 'Pentimento Fresco',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'An earlier image returns through the painted surface, unwilling to be forgotten.',
  placeholder: {
    color: hsl.integer(267, 86, 53.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
