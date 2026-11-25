import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quantum_damascus',
  candidateId: 'gemini_flash',
  title: 'Quantum Damascus',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Folded bands of metal seem to belong to more than one possible pattern.',
  placeholder: {
    color: hsl.integer(269, 96, 57),
    shading: 'metal',
  },
} as const satisfies KnotData
