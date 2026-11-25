import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre_nocturne',
  candidateId: 'gpt_astra',
  title: 'Nacre Nocturne',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The moon left its sheet music inside a shell. Each hand-cut fragment remembers a different color of the tide.',
  placeholder: {
    color: hsl.integer(298, 31, 56),
    shading: 'glass',
  },
} as const satisfies KnotData
