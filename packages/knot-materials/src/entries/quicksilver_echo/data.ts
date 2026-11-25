import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quicksilver_echo',
  candidateId: 'claude_fable',
  title: 'Quicksilver Echo',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'The silver answers every movement with a reflection that seems almost remembered.',
  placeholder: {
    color: hsl.integer(262, 100, 94),
    shading: 'liquid',
  },
} as const satisfies KnotData
