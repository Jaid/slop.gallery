import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cyber_kintsugi',
  candidateId: 'gemini_flash',
  title: 'Cyber Kintsugi',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A fractured circuit heals itself with a seam of electric gold.',
  placeholder: {
    color: hsl.integer(84, 96.6, 81),
    shading: 'stone',
  },
} as const satisfies KnotData
