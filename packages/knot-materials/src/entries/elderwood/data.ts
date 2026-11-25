import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HU72JSGdKyp7pBO; fixture: knot-material-shaders; result: success.
export default {
  id: 'elderwood',
  candidateId: 'gpt_sol',
  title: 'Elderwood',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Centuries curl beneath a polished wound. Mineral sap still travels the grain, carrying the green memory of a lost orchard.',
  placeholder: {
    color: hsl.integer(54, 64, 51),
    shading: 'stone',
  },
} as const satisfies KnotData
