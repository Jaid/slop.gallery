import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'iris_engine',
  candidateId: 'gpt_sol',
  title: 'Iris Engine',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'An optical machine dreams in folded spectra. Its silver apertures open into colors that exist only where you are standing.',
  placeholder: {
    color: hsl.integer(241, 20, 56),
    shading: 'metal',
  },
} as const satisfies KnotData
