import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'morpho_chrysalis',
  candidateId: 'deepseek',
  title: 'Morpho Chrysalis',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Wings folded into a knot, still holding the sky they were meant to cross.',
  placeholder: {
    color: hsl.integer(286, 60, 23),
    shading: 'smooth',
  },
} as const satisfies KnotData
