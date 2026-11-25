import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelial_moon',
  candidateId: 'gpt_luna',
  title: 'Mycelial Moon',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'Under a dark woodland skin, a patient constellation of mycelium carries moonlight from root to root.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(163, 47, 36),
    shading: 'stone',
  },
} as const satisfies KnotData
