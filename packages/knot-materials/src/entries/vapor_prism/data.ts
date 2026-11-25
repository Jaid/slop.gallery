import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vapor_prism',
  candidateId: 'hy',
  title: 'Vapor Prism',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A little drifting mist persuades daylight to reveal its hidden colors.',
  placeholder: {
    color: hsl.integer(254, 29, 95),
    shading: 'glass',
  },
} as const satisfies KnotData
