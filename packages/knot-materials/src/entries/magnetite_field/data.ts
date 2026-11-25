import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'magnetite_field',
  candidateId: 'gpt_sol',
  title: 'Magnetite Field',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Iron-dark grains reveal the contours of an invisible landscape.',
  placeholder: {
    color: hsl.integer(214, 22, 73),
    shading: 'metal',
  },
  displacement: 0.046,
} as const satisfies KnotData
