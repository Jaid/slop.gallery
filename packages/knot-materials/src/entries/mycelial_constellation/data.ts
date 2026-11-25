import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelial_constellation',
  candidateId: 'gpt_terra',
  title: 'Mycelial Constellation',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Beneath a velvet forest floor, luminous hyphae trade starlight in slow pulses only the patient can see.',
  displacement: 0.007,
  placeholder: {
    color: hsl.integer(155, 49, 32),
    shading: 'stone',
  },
} as const satisfies KnotData
