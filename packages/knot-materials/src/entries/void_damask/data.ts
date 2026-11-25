import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'void_damask',
  candidateId: 'gemini_flash',
  title: 'Void Damask',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Celestial threads weave across the dark, where moiré ripples shimmer like tides in an unseen sea.',
  placeholder: {
    color: hsl.integer(267, 35, 11),
    shading: 'fabric',
  },
} as const satisfies KnotData
