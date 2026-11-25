import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'threshold_mirror',
  candidateId: 'claude_fable',
  title: 'Threshold Mirror',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'The reflection looks less like this room than the entrance to another one.',
  placeholder: {
    color: hsl.integer(202, 99, 89),
    shading: 'smooth',
  },
} as const satisfies KnotData
