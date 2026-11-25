import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'verdigris_testament',
  candidateId: 'gpt_sol',
  title: 'Verdigris Testament',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  displacement: 0.004,
  flavorText: 'The sea has written over an emperor’s bronze. Beneath turquoise centuries, the raised spirals still answer a passing lantern.',
  placeholder: {
    color: hsl.integer(183, 64, 59),
    shading: 'metal',
  },
} as const satisfies KnotData
