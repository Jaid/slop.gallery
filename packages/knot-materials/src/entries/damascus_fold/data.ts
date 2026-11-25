import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'damascus_fold',
  candidateId: 'claude_opus',
  title: 'Damascus Fold',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Countless hammer blows have become a landscape of silver currents.',
  placeholder: {
    color: hsl.integer(88, 18, 84),
    shading: 'metal',
  },
} as const satisfies KnotData
