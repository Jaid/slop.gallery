import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'petal_testament',
  candidateId: 'gpt_astra',
  title: 'Petal Testament',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.0018,
  flavorText: 'Unsent letters have taught themselves to blossom. Every paper petal holds a crease where a voice almost became a word.',
  placeholder: {
    color: hsl.integer(10, 29, 73),
    shading: 'smooth',
  },
} as const satisfies KnotData
