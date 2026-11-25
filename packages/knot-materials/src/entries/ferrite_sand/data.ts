import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferrite_sand',
  candidateId: 'hy',
  title: 'Ferrite Sand',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Dark grains lean together as though listening for a distant magnet.',
  placeholder: {
    color: hsl.integer(217, 99, 78.9),
    shading: 'metal',
  },
} as const satisfies KnotData
