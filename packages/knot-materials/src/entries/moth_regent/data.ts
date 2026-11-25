import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'moth_regent',
  candidateId: 'gpt_astra',
  title: 'Moth Regent',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A sovereign with no throne wears a thousand tiny mirrors. Move softly; its velvet eyes are learning the shape of your light.',
  placeholder: {
    color: hsl.integer(180, 46, 29),
    shading: 'fabric',
  },
} as const satisfies KnotData
