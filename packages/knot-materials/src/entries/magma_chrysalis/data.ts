import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'magma_chrysalis',
  candidateId: 'gemini_flash',
  title: 'Magma Chrysalis',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A shell of cooling rock guards a bright metamorphosis within.',
  placeholder: {
    color: hsl.integer(56, 95, 71.8),
    shading: 'liquid',
  },
} as const satisfies KnotData
