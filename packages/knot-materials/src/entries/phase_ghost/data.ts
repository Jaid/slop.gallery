import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'phase_ghost',
  candidateId: 'claude_fable',
  title: 'Phase Ghost',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'The surface keeps arriving a fraction of a moment after its reflection.',
  placeholder: {
    color: hsl.integer(203, 99, 89.6),
    shading: 'ghost',
  },
} as const satisfies KnotData
