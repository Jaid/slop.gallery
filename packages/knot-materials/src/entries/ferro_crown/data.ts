import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferro_crown',
  candidateId: 'claude_opus',
  title: 'Ferro Crown',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A black crown rises to meet an invisible command.',
  placeholder: {
    color: hsl.integer(264, 28, 15),
    shading: 'metal',
  },
  displacement: 0.06,
} as const satisfies KnotData
