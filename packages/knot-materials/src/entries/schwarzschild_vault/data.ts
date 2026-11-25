import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'schwarzschild_vault',
  candidateId: 'gemini_flash',
  title: 'Schwarzschild Vault',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A dark chamber gathers every reflection and gives none of them a straight path out.',
  placeholder: {
    color: hsl.integer(233, 93, 71),
    shading: 'smooth',
  },
} as const satisfies KnotData
