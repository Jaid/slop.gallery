import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'plasma_cell',
  candidateId: 'hy',
  title: 'Plasma Cell',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A charged glow presses against the walls of its fragile chamber.',
  placeholder: {
    color: hsl.integer(224, 100, 95),
    shading: 'liquid',
  },
} as const satisfies KnotData
