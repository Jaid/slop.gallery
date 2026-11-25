import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'mended_tide',
  candidateId: 'claude_opus',
  title: 'Mended Tide',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'The painted sea broke once and was mended with gold. Its waves still roll on, and they now pass through the scars.',
  placeholder: {
    color: hsl.integer(266, 100, 92),
    shading: 'smooth',
  },
} as const satisfies KnotData
