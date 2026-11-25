import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'radiometric_guilloche',
  candidateId: 'gemini_flash',
  title: 'Radiometric Guilloché',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Fine engraved loops shelter a faint green glow that outlasts the lamps.',
  placeholder: {
    color: hsl.integer(82, 100, 86.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
