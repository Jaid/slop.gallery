import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tidal_treasury',
  candidateId: 'gpt_astra',
  title: 'Tidal Treasury',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'The ocean hides its finest colors between layers of pearl, opening each small door only to a moving eye.',
  placeholder: {
    color: hsl.integer(205, 46, 54),
    shading: 'glass',
  },
} as const satisfies KnotData
