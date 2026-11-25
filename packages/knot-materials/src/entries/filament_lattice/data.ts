import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'filament_lattice',
  candidateId: 'claude_opus',
  title: 'Filament Lattice',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Fine strands hold an intricate agreement between light and empty space.',
  placeholder: {
    color: hsl.integer(71, 100, 78),
    shading: 'glass',
  },
} as const satisfies KnotData
