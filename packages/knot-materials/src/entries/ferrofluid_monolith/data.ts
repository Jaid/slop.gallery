import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferrofluid_monolith',
  candidateId: 'gemini_flash',
  title: 'Ferrofluid Monolith',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A dark monument remembers that it was once a flowing thing.',
  placeholder: {
    color: hsl.integer(330, 76, 57),
    shading: 'liquid',
  },
} as const satisfies KnotData
