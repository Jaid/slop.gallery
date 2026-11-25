import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'washi_lantern',
  candidateId: 'claude_fable',
  title: 'Washi Lantern',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Warm light finds its way through the quiet grain of handmade paper.',
  placeholder: {
    color: hsl.integer(63, 100, 79.5),
    shading: 'fabric',
  },
} as const satisfies KnotData
