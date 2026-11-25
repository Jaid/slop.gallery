import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prism_cathedral',
  candidateId: 'claude_opus',
  title: 'Prism Cathedral',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'The windows have become the walls, and every wall is another window.',
  placeholder: {
    color: hsl.integer(263, 79, 55),
    shading: 'glass',
  },
} as const satisfies KnotData
