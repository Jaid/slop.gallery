import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'porifera',
  candidateId: 'gpt_astra',
  title: 'Porifera',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A porcelain organism dreams in chambers. The pale skin opens onto a cool green labyrinth that breathes without a single lung.',
  placeholder: {
    color: hsl.integer(90, 19, 83),
    shading: 'stone',
  },
} as const satisfies KnotData
