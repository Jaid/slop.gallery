import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'fiber_loom',
  candidateId: 'claude_opus',
  title: 'Fiber Loom',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Woven from threads of frozen light, each fiber carries a pulse that has forgotten where it began.',
  placeholder: {
    color: hsl.integer(262, 39, 37),
    shading: 'fabric',
  },
} as const satisfies KnotData
