import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hoar_frost',
  candidateId: 'hy',
  title: 'Hoar Frost',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: "The night's last breath has become a coat of silver needles.",
  placeholder: {
    color: hsl.integer(240, 100, 96),
    shading: 'glass',
  },
} as const satisfies KnotData
