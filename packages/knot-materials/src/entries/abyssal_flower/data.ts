import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_flower',
  candidateId: 'hy',
  title: 'Abyssal Flower',
  createdAt: 1_790_126_896,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'Something patient flowers beneath the reach of every lighthouse.',
  placeholder: {
    color: hsl.integer(171, 100, 87),
    shading: 'fabric',
  },
} as const satisfies KnotData
