import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lichtenberg_reliquary',
  candidateId: 'claude_fable',
  title: 'Lichtenberg Reliquary',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'A branching flash rests inside its vessel like a saint of brief things.',
  placeholder: {
    color: hsl.integer(270, 100, 62),
    shading: 'smooth',
  },
} as const satisfies KnotData
