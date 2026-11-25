import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'signal_bloom',
  candidateId: 'gpt_astra',
  title: 'Signal Bloom',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'An impossible flower broadcasts from the future. Move, and its petals remember a different arrangement.',
  placeholder: {
    color: hsl.integer(29, 77, 63),
    shading: 'smooth',
  },
} as const satisfies KnotData
