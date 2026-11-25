import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'desert_glaze',
  candidateId: 'hy',
  title: 'Desert Glaze',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: "A day's heat has dried into the colors of a distant dune.",
  placeholder: {
    color: hsl.integer(235, 57, 38),
    shading: 'smooth',
  },
} as const satisfies KnotData
