import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nebula_reliquary',
  candidateId: 'claude_fable',
  title: 'Nebula Reliquary',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'A little cosmic weather turns inside a shrine too small for its sky.',
  placeholder: {
    color: hsl.integer(308, 100, 67),
    shading: 'smooth',
  },
} as const satisfies KnotData
