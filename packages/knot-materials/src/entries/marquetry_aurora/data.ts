import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'marquetry_aurora',
  candidateId: 'gpt_terra',
  title: 'Marquetry Aurora',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Walnut, maple and quiet brass are fitted into a nocturnal current, a hand-made dawn traveling through the grain.',
  displacement: 0.008,
  placeholder: {
    color: hsl.integer(53, 57, 38),
    shading: 'smooth',
  },
} as const satisfies KnotData
