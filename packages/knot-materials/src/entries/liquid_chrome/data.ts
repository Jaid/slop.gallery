import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'liquid_chrome',
  candidateId: 'hy',
  title: 'Liquid Chrome',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'The room pours across a silver surface that refuses to stay still.',
  placeholder: {
    color: hsl.integer(49, 100, 67.9),
    shading: 'liquid',
  },
} as const satisfies KnotData
