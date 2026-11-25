import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_siphonophore',
  candidateId: 'gemini_flash',
  title: 'Abyssal Siphonophore',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Drifting through the midnight trench, a glass colony pulses with traveling ribbons of living rainbow light.',
  placeholder: {
    color: hsl.integer(205, 94, 42),
    shading: 'glass',
  },
} as const satisfies KnotData
