import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'meissner_quantum',
  candidateId: 'gemini_flash',
  title: 'Meissner Quantum',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Sub-zero ceramics trap magnetic vortices in silence, humming with superconducting currents that never decay.',
  placeholder: {
    color: hsl.integer(239, 66, 25),
    shading: 'metal',
  },
} as const satisfies KnotData
