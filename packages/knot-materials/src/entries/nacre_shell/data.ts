import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre_shell',
  candidateId: 'hy',
  title: 'Nacre Shell',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: "The sea's patient craftsmanship turns rough beginnings into a luminous shelter.",
  placeholder: {
    color: hsl.integer(90, 77, 97),
    shading: 'glass',
  },
} as const satisfies KnotData
