import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_terraces',
  candidateId: 'gpt_luna',
  title: 'Bismuth Terraces',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'Rainbow stairways grow through a midnight crystal, each impossible terrace changing its color when you move.',
  displacement: 0.005,
  placeholder: {
    color: hsl.integer(294, 51, 51),
    shading: 'metal',
  },
} as const satisfies KnotData
