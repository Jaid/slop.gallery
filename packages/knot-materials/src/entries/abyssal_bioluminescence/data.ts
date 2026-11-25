import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_bioluminescence',
  candidateId: 'gemini_flash',
  title: 'Abyssal Bioluminescence',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Tiny colonies carry their blue messages through a sea without a sunrise.',
  placeholder: {
    color: hsl.integer(173, 100, 87),
    shading: 'glass',
  },
} as const satisfies KnotData
