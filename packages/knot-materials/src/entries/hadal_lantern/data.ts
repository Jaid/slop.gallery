import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hadal_lantern',
  candidateId: 'claude_fable',
  title: 'Hadal Lantern',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'A cold lamp glows for travelers who have never known the surface.',
  placeholder: {
    color: hsl.integer(213, 100, 82.3),
    shading: 'glass',
  },
} as const satisfies KnotData
