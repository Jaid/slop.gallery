import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'diffraction_choir',
  candidateId: 'gpt_astra',
  title: 'Diffraction Choir',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'A thousand engraved grooves sing in wavelengths. Each step conducts another voice through the silver silence.',
  placeholder: {
    color: hsl.integer(243, 16, 64),
    shading: 'metal',
  },
} as const satisfies KnotData
