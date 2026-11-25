import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'enamel_semaphore',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  title: 'Enamel Semaphore',
  createdAt: 1_789_816_097,
  flavorText: 'A message for ships that never sailed, fired into enamel and folded beyond the horizon.',
  placeholder: {
    color: hsl.integer(33, 90, 57.7),
    shading: 'smooth',
  },
} as const satisfies KnotData
