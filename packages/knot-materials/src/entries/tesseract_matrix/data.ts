import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tesseract_matrix',
  candidateId: 'gemini_flash',
  title: 'Tesseract Matrix',
  createdAt: 1_789_290_805,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A lattice hints at corners that cannot all belong to the same space.',
  placeholder: {
    color: hsl.integer(200, 100, 86),
    shading: 'ghost',
  },
} as const satisfies KnotData
