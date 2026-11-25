import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_chiaroscuro',
  candidateId: 'gpt_sol',
  title: 'Velvet Chiaroscuro',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Light rests on the high folds while the deep fabric keeps its shadows.',
  placeholder: {
    color: hsl.integer(296, 100, 58.5),
    shading: 'fabric',
  },
} as const satisfies KnotData
