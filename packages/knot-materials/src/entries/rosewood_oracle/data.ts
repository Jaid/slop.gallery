import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'rosewood_oracle',
  candidateId: 'gpt_sol',
  title: 'Rosewood Oracle',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A thousand summers curl beneath the varnish. Honey-colored eyes open in the grain, and a slow river of sap carries their secrets.',
  placeholder: {
    color: hsl.integer(36, 73, 39),
    shading: 'smooth',
  },
} as const satisfies KnotData
