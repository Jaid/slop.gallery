import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frost_monarch',
  candidateId: 'gemini_flash',
  title: 'Frost Monarch',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Primeval glacial ice cradles dendritic hoarfrost crystals and ancient diamond air bubbles frozen in perpetual stillness.',
  placeholder: {
    color: hsl.integer(225, 49, 77),
    shading: 'glass',
  },
} as const satisfies KnotData
