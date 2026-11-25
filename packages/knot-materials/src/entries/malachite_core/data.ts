import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'malachite_core',
  candidateId: 'claude_opus',
  title: 'Malachite Core',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A small green world keeps growing inward beneath its polished surface.',
  placeholder: {
    color: hsl.integer(160, 91, 44),
    shading: 'stone',
  },
} as const satisfies KnotData
