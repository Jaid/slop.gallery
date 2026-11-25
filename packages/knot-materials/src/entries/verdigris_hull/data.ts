import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'verdigris_hull',
  candidateId: 'hy',
  title: 'Verdigris Hull',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'The metal keeps a tide mark from a voyage no map remembers.',
  placeholder: {
    color: hsl.integer(184, 73, 61),
    shading: 'smooth',
  },
} as const satisfies KnotData
