import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'shoreless_pearl',
  candidateId: 'gpt_terra',
  title: 'Shoreless Pearl',
  createdAt: 1_791_852_458,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A pearl from water without a shore carries moonlit layers beneath its skin, tender colors arriving only when invited.',
  placeholder: {
    color: hsl.integer(215, 23, 43),
    shading: 'glass',
  },
} as const satisfies KnotData
