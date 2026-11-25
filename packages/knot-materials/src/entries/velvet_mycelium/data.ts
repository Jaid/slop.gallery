import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_mycelium',
  candidateId: 'gemini_flash',
  title: 'Velvet Mycelium',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A dark, soft garden sends luminous threads through its hidden undergrowth.',
  placeholder: {
    color: hsl.integer(322, 93, 61.3),
    shading: 'fabric',
  },
} as const satisfies KnotData
