import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 3gQGAbAm59HYY8k; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'lodestone_bloom',
  candidateId: 'claude_haiku',
  title: 'Lodestone Bloom',
  createdAt: 1_791_758_567,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A black iron tide rises into thorns the moment a magnet walks past, and every spike leans toward you as if you were the lodestone.',
  placeholder: {
    color: hsl.integer(230, 16, 10),
    shading: 'metal',
  },
} as const satisfies KnotData
