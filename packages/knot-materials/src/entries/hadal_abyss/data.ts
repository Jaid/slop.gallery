import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hadal_abyss',
  candidateId: 'gemini_flash',
  title: 'Hadal Siphonophore',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Pressure and darkness have polished this relic beyond the reach of waves.',
  placeholder: {
    color: hsl.integer(178, 100, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
