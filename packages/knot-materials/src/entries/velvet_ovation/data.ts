import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4cRctoZrXREvmK4; fixture: knot-material-shaders; result: success.
export default {
  id: 'velvet_ovation',
  candidateId: 'gpt_sol',
  title: 'Velvet Ovation',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A midnight theater keeps its last applause in wine-dark velvet. Golden feathers stir when an unseen audience leans toward the curtain.',
  placeholder: {
    color: hsl.integer(3, 78, 21),
    shading: 'fabric',
  },
} as const satisfies KnotData
