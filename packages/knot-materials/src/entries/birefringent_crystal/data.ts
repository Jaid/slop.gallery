import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'birefringent_crystal',
  candidateId: 'gemini_flash',
  title: 'Birefringent Crystal',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Each ray enters alone and leaves with a second story.',
  placeholder: {
    color: hsl.integer(221, 100, 85),
    shading: 'glass',
  },
} as const satisfies KnotData
