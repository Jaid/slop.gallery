import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelium_veil',
  candidateId: 'hy',
  title: 'Mycelium Veil',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Fine threads draw a soft curtain between the visible world and its hidden growth.',
  placeholder: {
    color: hsl.integer(131, 100, 92.6),
    shading: 'fabric',
  },
} as const satisfies KnotData
