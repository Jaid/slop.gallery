import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'paper_pilgrimage',
  candidateId: 'gpt_astra',
  title: 'Paper Pilgrimage',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Ten thousand quiet shores, cut from a single unwritten book. The tide turns one page at a time.',
  placeholder: {
    color: hsl.integer(57, 35, 77),
    shading: 'smooth',
  },
} as const satisfies KnotData
