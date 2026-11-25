import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 3gQGAbAm59HYY8k; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'noctiluca_tide',
  candidateId: 'claude_haiku',
  title: 'Noctiluca Tide',
  createdAt: 1_791_758_567,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Something sleeps in the dark sea-skin until a footstep wakes it, and a wave of cold green light runs outward from the place nearest you.',
  placeholder: {
    color: hsl.integer(215, 89, 16),
    shading: 'liquid',
  },
} as const satisfies KnotData
