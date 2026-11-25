import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'abyssal_chorus',
  candidateId: 'claude_opus',
  title: 'Abyssal Chorus',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Eight rows of tiny oars row light through the dark water. Come too close and the whole creature startles into a cold blue song.',
  placeholder: {
    color: hsl.integer(262, 71, 12),
    shading: 'glass',
  },
} as const satisfies KnotData
