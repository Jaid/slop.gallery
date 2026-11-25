import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quantum_superconductor',
  candidateId: 'gemini_flash',
  title: 'Quantum Superconductor',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A cold current follows its perfect circle without leaving a trace of heat.',
  placeholder: {
    color: hsl.integer(294, 87, 66),
    shading: 'smooth',
  },
} as const satisfies KnotData
