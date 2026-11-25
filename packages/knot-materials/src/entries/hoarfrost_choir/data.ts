import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HU72JSGdKyp7pBO; fixture: knot-material-shaders; result: success.
export default {
  id: 'hoarfrost_choir',
  candidateId: 'gpt_sol',
  title: 'Hoarfrost Choir',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Sixfold voices grow across a frozen silence. Their breath is almost invisible, until the light catches every branch.',
  placeholder: {
    color: hsl.integer(221, 30, 81),
    shading: 'glass',
  },
} as const satisfies KnotData
