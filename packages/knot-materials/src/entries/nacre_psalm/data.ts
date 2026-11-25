import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre_psalm',
  candidateId: 'gpt_terra',
  title: 'Nacre Psalm',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A quiet hymn in calcium and light: each pearly layer changes its answer as the visitor moves.',
  placeholder: {
    color: hsl.integer(17, 11, 81),
    shading: 'glass',
  },
} as const satisfies KnotData
