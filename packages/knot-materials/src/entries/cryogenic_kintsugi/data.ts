import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cryogenic_kintsugi',
  candidateId: 'gemini_flash',
  title: 'Cryogenic Kintsugi',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Golden seams persuade the broken ice to remain a single story.',
  placeholder: {
    color: hsl.integer(202, 100, 85),
    shading: 'glass',
  },
} as const satisfies KnotData
