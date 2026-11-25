import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_velvet',
  candidateId: 'claude_opus',
  title: 'Abyssal Velvet',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Midnight folds itself around a faint, saltwater glow.',
  placeholder: {
    color: hsl.integer(201, 78, 42),
    shading: 'fabric',
  },
} as const satisfies KnotData
