import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vacuum_froth',
  candidateId: 'claude_sonnet',
  title: 'Quantum Foam',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'Small bright pockets trouble a space that ought to contain nothing at all.',
  placeholder: {
    color: hsl.integer(207, 100, 90),
    shading: 'smooth',
  },
} as const satisfies KnotData
