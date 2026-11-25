import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'sapphire_orrery',
  candidateId: 'gpt_sol',
  title: 'Sapphire Orrery',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Tiny heavens turn beneath midnight sapphire. Every golden orbit keeps the time of a star that has not yet been born.',
  placeholder: {
    color: hsl.integer(243, 69, 23),
    shading: 'metal',
  },
} as const satisfies KnotData
