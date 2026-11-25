import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'scarab_aegis',
  candidateId: 'gemini_flash',
  title: 'Scarab Aegis',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Layered jewel armor guards a secret small enough to fit beneath a wing.',
  placeholder: {
    color: hsl.integer(162, 98, 65),
    shading: 'smooth',
  },
} as const satisfies KnotData
