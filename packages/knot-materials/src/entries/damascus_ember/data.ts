import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'damascus_ember',
  candidateId: 'claude_fable',
  title: 'Damascus Ember',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Folded steel carries a little of the fire that taught it strength.',
  placeholder: {
    color: hsl.integer(43, 100, 65.3),
    shading: 'metal',
  },
} as const satisfies KnotData
