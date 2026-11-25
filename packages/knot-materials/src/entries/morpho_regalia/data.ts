import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'morpho_regalia',
  candidateId: 'glm',
  title: 'Morpho Regalia',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Blue wings lend their splendor to a crown lighter than air.',
  placeholder: {
    color: hsl.integer(221, 100, 79.7),
    shading: 'smooth',
  },
} as const satisfies KnotData
