import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'resonant_cymatics',
  candidateId: 'gemini_flash',
  title: 'Resonant Cymatics',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Dust gathers into changing figures under the persuasion of an unheard note.',
  placeholder: {
    color: hsl.integer(151, 95, 81),
    shading: 'smooth',
  },
} as const satisfies KnotData
