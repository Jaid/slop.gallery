import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'plasma_weave',
  candidateId: 'hy',
  title: 'Plasma Weave',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Hot strands cross and part like threads in an electric loom.',
  placeholder: {
    color: hsl.integer(209, 100, 82),
    shading: 'fabric',
  },
} as const satisfies KnotData
