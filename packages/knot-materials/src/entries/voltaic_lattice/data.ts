import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'voltaic_lattice',
  candidateId: 'claude_opus',
  title: 'Voltaic Lattice',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A fine framework passes blue sparks from one invisible charge to the next.',
  placeholder: {
    color: hsl.integer(267, 100, 45),
    shading: 'glass',
  },
} as const satisfies KnotData
