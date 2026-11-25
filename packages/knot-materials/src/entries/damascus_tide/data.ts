import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'damascus_tide',
  candidateId: 'claude_fable',
  title: 'Damascus Tide',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Dark and bright metal flow together without ever truly mixing.',
  placeholder: {
    color: hsl.integer(251, 19, 83),
    shading: 'liquid',
  },
} as const satisfies KnotData
