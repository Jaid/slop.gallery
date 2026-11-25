import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vantablack_filigree',
  candidateId: 'hy',
  title: 'Vantablack Filigree',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'Delicate lines of light cling to the edge of an almost complete darkness.',
  placeholder: {
    color: hsl.integer(14, 99, 59),
    shading: 'smooth',
  },
} as const satisfies KnotData
