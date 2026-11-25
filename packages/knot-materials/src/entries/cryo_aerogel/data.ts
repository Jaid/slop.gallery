import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cryo_aerogel',
  candidateId: 'gemini_flash',
  title: 'Cryo Aerogel',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Cold light rests in a substance almost too slight to cast a shadow.',
  placeholder: {
    color: hsl.integer(208, 90, 84),
    shading: 'glass',
  },
} as const satisfies KnotData
