import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'punched_pianola',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  title: 'Punched Pianola',
  createdAt: 1_789_816_097,
  flavorText: 'The missing pieces hold the music; the brass remembers only the spaces between notes.',
  placeholder: {
    color: hsl.integer(79, 58, 63),
    shading: 'metal',
  },
} as const satisfies KnotData
