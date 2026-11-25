import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'glacial_cipher',
  candidateId: 'gpt_sol',
  title: 'Glacial Cipher',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'The glacier has written its secrets in fractures too cold to speak.',
  placeholder: {
    color: hsl.integer(212, 100, 89.4),
    shading: 'glass',
  },
} as const satisfies KnotData
