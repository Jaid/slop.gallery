import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'petrichor',
  candidateId: 'glm',
  title: 'Petrichor',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: 'The first rain leaves its dark fragrance in the memory of warm stone.',
  placeholder: {
    color: hsl.integer(239, 100, 83.3),
    shading: 'stone',
  },
} as const satisfies KnotData
