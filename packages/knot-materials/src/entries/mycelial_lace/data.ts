import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelial_lace',
  candidateId: 'gpt_astra',
  title: 'Mycelial Lace',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Beneath a quiet forest, a pale intelligence embroiders the dark. Each soft pulse carries a message too old for words.',
  placeholder: {
    color: hsl.integer(97, 21, 76),
    shading: 'stone',
  },
} as const satisfies KnotData
