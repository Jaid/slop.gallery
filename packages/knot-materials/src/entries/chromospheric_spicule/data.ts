import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chromospheric_spicule',
  candidateId: 'gemini_flash',
  title: 'Chromospheric Spicule',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Fine tongues of fire rise from the restless skin of a star.',
  placeholder: {
    color: hsl.integer(32.5, 100, 59.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
