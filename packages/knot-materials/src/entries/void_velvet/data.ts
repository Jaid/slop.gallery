import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'void_velvet',
  candidateId: 'hy',
  title: 'Void Velvet',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A plush darkness opens around a light that never quite reaches its center.',
  placeholder: {
    color: hsl.integer(285, 15, 3),
    shading: 'fabric',
  },
} as const satisfies KnotData
