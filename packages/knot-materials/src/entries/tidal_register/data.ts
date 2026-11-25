import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tidal_register',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  title: 'Tidal Register',
  createdAt: 1_789_816_097,
  flavorText: 'Small enamel shutters turn in patient succession, recording a tide that never reaches the shore.',
  placeholder: {
    color: hsl.integer(181, 49, 70),
    shading: 'metal',
  },
} as const satisfies KnotData
