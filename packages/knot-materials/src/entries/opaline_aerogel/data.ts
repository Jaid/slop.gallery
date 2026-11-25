import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opaline_aerogel',
  candidateId: 'gemini_flash',
  title: 'Opaline Aerogel',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A cloud has learned to hold its shape, but not to keep its colors still.',
  placeholder: {
    color: hsl.integer(242, 100, 76.5),
    shading: 'glass',
  },
} as const satisfies KnotData
