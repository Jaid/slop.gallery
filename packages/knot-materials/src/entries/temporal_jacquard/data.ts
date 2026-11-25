import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'temporal_jacquard',
  candidateId: 'gemini_flash',
  title: 'Temporal Jacquard',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A woven pattern lets yesterday show through the threads of tomorrow.',
  placeholder: {
    color: hsl.integer(82, 68, 77),
    shading: 'fabric',
  },
} as const satisfies KnotData
