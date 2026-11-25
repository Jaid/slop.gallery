import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'coronal_ropes',
  candidateId: 'gemini_flash',
  title: 'Coronal Ropes',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Thermonuclear convection boils across magnetic sunspots as coronal plasma ropes twist along the stellar horizon.',
  displacement: 0.008,
  placeholder: {
    color: hsl.integer(43, 90, 56),
    shading: 'smooth',
  },
} as const satisfies KnotData
