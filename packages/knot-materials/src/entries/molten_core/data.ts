import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'molten_core',
  candidateId: 'claude_sonnet',
  title: 'Molten Core',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'A thin crust is all that separates the room from a small furnace.',
  placeholder: {
    color: hsl.integer(37, 100, 65.6),
    shading: 'liquid',
  },
} as const satisfies KnotData
