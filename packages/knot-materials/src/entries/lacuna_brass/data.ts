import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lacuna_brass',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  title: 'Lacuna Brass',
  createdAt: 1_789_816_097,
  flavorText: 'A brass music roll keeps its missing notes, waiting for an instrument that can play a circle.',
  placeholder: {
    color: hsl.integer(79, 65, 67),
    shading: 'metal',
  },
} as const satisfies KnotData
