import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_silk',
  candidateId: 'glm',
  title: 'Solar Silk',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Threads of afternoon light slide across a cloth woven for the sun.',
  placeholder: {
    color: hsl.integer(85, 100, 92),
    shading: 'fabric',
  },
} as const satisfies KnotData
