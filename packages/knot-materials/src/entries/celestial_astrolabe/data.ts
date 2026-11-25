import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'celestial_astrolabe',
  candidateId: 'gemini_flash',
  title: 'Celestial Astrolabe',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Brass remembers the positions of stars that have already moved on.',
  placeholder: {
    color: hsl.integer(86, 86, 81),
    shading: 'metal',
  },
} as const satisfies KnotData
