import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'carmine_fold',
  candidateId: 'gpt_astra',
  title: 'Carmine Fold',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A single sheet rehearses the shape of infinity. Along its vermilion creases, a breath passes from mountain to paper valley.',
  displacement: 0.02,
  placeholder: {
    color: hsl.integer(31, 81, 54),
    shading: 'fabric',
  },
} as const satisfies KnotData
