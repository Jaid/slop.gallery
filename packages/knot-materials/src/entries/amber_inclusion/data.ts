import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_inclusion',
  candidateId: 'claude_opus',
  title: 'Amber Inclusion',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A fleeting spark has been granted an eternity inside warm resin.',
  placeholder: {
    color: hsl.integer(74, 84, 73),
    shading: 'glass',
  },
} as const satisfies KnotData
