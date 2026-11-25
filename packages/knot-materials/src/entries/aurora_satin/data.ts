import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_satin',
  candidateId: 'claude_sonnet',
  title: 'Aurora Veil',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'Cold light moves across a cloth too fine for human hands.',
  placeholder: {
    color: hsl.integer(171, 75, 88),
    shading: 'fabric',
  },
} as const satisfies KnotData
