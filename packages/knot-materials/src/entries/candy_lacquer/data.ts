import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'candy_lacquer',
  candidateId: 'gpt_terra',
  title: 'Candy Lacquer',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Cobalt, coral and mint fragments slide beneath a sugar-black varnish, changing partners when the orbit becomes sweet enough.',
  displacement: 0.011,
  placeholder: {
    color: hsl.integer(4, 81, 55),
    shading: 'smooth',
  },
} as const satisfies KnotData
