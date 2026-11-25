import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'volcanic_chrysalis',
  candidateId: 'gemini_flash',
  title: 'Magma Chrysalis',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A cracked volcanic shell waits for the bright creature forming beneath it.',
  placeholder: {
    color: hsl.integer(35.5, 100, 61.5),
    shading: 'smooth',
  },
  displacement: 0.018,
} as const satisfies KnotData
