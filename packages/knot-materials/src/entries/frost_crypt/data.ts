import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frost_crypt',
  candidateId: 'hy',
  title: 'Frost Crypt',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Pale crystals seal a chamber whose inhabitants are only echoes.',
  placeholder: {
    color: hsl.integer(240, 100, 96),
    shading: 'glass',
  },
} as const satisfies KnotData
