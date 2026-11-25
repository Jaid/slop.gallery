import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'meissner_vortex',
  candidateId: 'gemini_flash',
  title: 'Meissner Vortex',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Quantized magnetic flux threads a ceramic lattice, holding pure currents in frictionless stillness.',
  placeholder: {
    color: hsl.integer(225, 79, 33),
    shading: 'metal',
  },
} as const satisfies KnotData
