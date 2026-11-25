import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'black_opal',
  candidateId: 'gemini_flash',
  title: 'Black Opal',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Trapped inside dark ironstone, microscopic silica spheres ignite into blinding flashes of spectral fire as you turn.',
  placeholder: {
    color: hsl.integer(256, 21, 12),
    shading: 'glass',
  },
} as const satisfies KnotData
