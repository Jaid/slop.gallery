import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'stardust_relic',
  candidateId: 'glm',
  title: 'Stardust Relic',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Fine cosmic dust clings to an object older than its present constellation.',
  placeholder: {
    color: hsl.integer(258, 100, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
