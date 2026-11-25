import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'winter_exhalation',
  candidateId: 'gpt_sol',
  title: 'Winter Exhalation',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'An ocean exhales its last winter into crystal. Silver dendrites drift at different depths, each a small cathedral of cold.',
  placeholder: {
    color: hsl.integer(209, 45, 72),
    shading: 'glass',
  },
} as const satisfies KnotData
