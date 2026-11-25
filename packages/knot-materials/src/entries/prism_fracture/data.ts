import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prism_fracture',
  candidateId: 'qwen_max',
  title: 'Chronoclast',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'A broken ray returns as a mosaic of neighboring colors.',
  placeholder: {
    color: hsl.integer(0, 0, 100),
    shading: 'glass',
  },
} as const satisfies KnotData
