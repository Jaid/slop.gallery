import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'strata_slab',
  candidateId: 'hy',
  title: 'Strata Slab',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Layer after layer, the stone remembers how slowly a landscape is made.',
  placeholder: {
    color: hsl.integer(80, 29, 76),
    shading: 'stone',
  },
} as const satisfies KnotData
