import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lightless_border',
  candidateId: 'claude_fable',
  title: 'Lightless Border',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Beyond this dark border, even the light forgets its way home.',
  placeholder: {
    color: hsl.integer(51, 100, 71),
    shading: 'ghost',
  },
} as const satisfies KnotData
