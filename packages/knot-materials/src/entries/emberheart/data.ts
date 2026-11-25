import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'emberheart',
  candidateId: 'glm',
  title: 'Emberheart',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'The surface has cooled, but something inside still keeps the beat.',
  placeholder: {
    color: hsl.integer(37, 100, 63.7),
    shading: 'smooth',
  },
} as const satisfies KnotData
