import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'moire_sanctum',
  candidateId: 'claude_fable',
  title: 'Moiré Sanctum',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Layered screens turn the smallest movement into a hidden ceremony.',
  placeholder: {
    color: hsl.integer(91, 82, 73),
    shading: 'smooth',
  },
} as const satisfies KnotData
