import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_chromatophore',
  candidateId: 'claude_fable',
  title: 'Abyssal Chromatophore',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'The dark blushes when it notices you looking back.',
  placeholder: {
    color: hsl.integer(208.2, 100, 83.1),
    shading: 'smooth',
  },
} as const satisfies KnotData
