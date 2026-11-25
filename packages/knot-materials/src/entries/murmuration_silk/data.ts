import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'murmuration_silk',
  candidateId: 'gpt_luna',
  title: 'Murmuration Silk',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'A silk sky carries a flock of tiny copper birds; they wheel, settle and rise as you pass.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(226, 52, 28),
    shading: 'fabric',
  },
} as const satisfies KnotData
