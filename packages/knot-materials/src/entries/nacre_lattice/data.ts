import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre_lattice',
  candidateId: 'hy',
  title: 'Nacre Lattice',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Pearl arranges its layers into a delicate cage for wandering light.',
  placeholder: {
    color: hsl.integer(214, 18, 89),
    shading: 'glass',
  },
} as const satisfies KnotData
