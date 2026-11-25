import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'elytra_iridescence',
  candidateId: 'gemini_flash',
  title: 'Elytra Iridescence',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: "A beetle's armor holds more colors than its forest has names for.",
  placeholder: {
    color: hsl.integer(163, 95, 80),
    shading: 'smooth',
  },
} as const satisfies KnotData
