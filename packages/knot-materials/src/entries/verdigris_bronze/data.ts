import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'verdigris_bronze',
  candidateId: 'claude_sonnet',
  title: 'Verdigris Bronze',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Green weather slowly writes its history across the old bronze.',
  placeholder: {
    color: hsl.integer(165, 63, 57),
    shading: 'metal',
  },
} as const satisfies KnotData
