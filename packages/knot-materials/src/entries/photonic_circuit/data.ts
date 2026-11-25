import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4AEfQg7Qgj1dEVQ.
export default {
  id: 'photonic_circuit',
  candidateId: 'gemini_flash',
  title: 'Photonic Circuit',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Coherent light races through etched sapphire waveguides, dreaming in binary along pathways narrower than thought.',
  placeholder: {
    color: hsl.integer(259, 28, 22),
    shading: 'metal',
  },
} as const satisfies KnotData
