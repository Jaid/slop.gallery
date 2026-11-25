import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4cRctoZrXREvmK4; fixture: knot-material-shaders; result: success.
export default {
  id: 'afterimage',
  candidateId: 'gpt_sol',
  title: 'Afterimage',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Three impossible paintings occupy the same skin. Vermilion rivers, violet targets and a cream-colored labyrinth trade places as your shadow passes.',
  placeholder: {
    color: hsl.integer(33, 98, 60.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
