import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'planck_foam',
  candidateId: 'hy',
  title: 'Planck Foam',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'Tiny chambers gather at the edge of what can be measured.',
  placeholder: {
    color: hsl.integer(286, 99, 53),
    shading: 'liquid',
  },
} as const satisfies KnotData
