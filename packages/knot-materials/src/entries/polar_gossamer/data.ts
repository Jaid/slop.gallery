import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'polar_gossamer',
  candidateId: 'hy',
  title: 'Aurora Veil',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'A fine green thread drifts loose from the fabric of the northern sky.',
  placeholder: {
    color: hsl.integer(156.7, 100, 86),
    shading: 'fabric',
  },
} as const satisfies KnotData
