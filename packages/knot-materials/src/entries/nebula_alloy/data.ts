import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nebula_alloy',
  candidateId: 'hy',
  title: 'Nebula Alloy',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A foundry beyond the stars has folded colored dust into this metal.',
  placeholder: {
    color: hsl.integer(264, 9, 13),
    shading: 'metal',
  },
} as const satisfies KnotData
