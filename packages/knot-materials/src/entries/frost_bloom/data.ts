import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frost_bloom',
  candidateId: 'glm',
  title: 'Frost Bloom',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Winter makes a brief garden on a surface it cannot keep.',
  placeholder: {
    color: hsl.integer(241, 100, 91),
    shading: 'fabric',
  },
} as const satisfies KnotData
