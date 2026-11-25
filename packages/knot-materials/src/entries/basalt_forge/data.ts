import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'basalt_forge',
  candidateId: 'hy',
  title: 'Basalt Forge',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'The mountain has not quite finished making this stone.',
  placeholder: {
    color: hsl.integer(90, 77, 97),
    shading: 'stone',
  },
} as const satisfies KnotData
