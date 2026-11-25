import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'semaphore_enamel',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  title: 'Semaphore Enamel',
  createdAt: 1_789_816_097,
  flavorText: 'Vermilion flags wait in brass frames, spelling a patient message to a train that never arrives.',
  placeholder: {
    color: hsl.integer(31, 84, 52),
    shading: 'smooth',
  },
} as const satisfies KnotData
