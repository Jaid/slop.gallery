import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelial_down',
  candidateId: 'claude_opus',
  title: 'Mycelial Down',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Soft fungal threads gather like a pale breath along the dark.',
  placeholder: {
    color: hsl.integer(161, 74, 88.5),
    shading: 'fabric',
  },
} as const satisfies KnotData
