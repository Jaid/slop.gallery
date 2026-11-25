import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'sunset_rose_window',
  candidateId: 'claude_opus',
  title: 'Sunset Rose Window',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Somewhere inside the knot the sun is setting, and a whole cathedral of colored glass is catching the last of its light.',
  placeholder: {
    color: hsl.integer(7, 71, 32),
    shading: 'glass',
  },
} as const satisfies KnotData
