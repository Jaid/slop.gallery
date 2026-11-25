import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'malachite',
  candidateId: 'gpt_astra',
  title: 'Emerald Heart',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'Green bands circle an ancient secret, one mineral season at a time.',
  placeholder: {
    color: hsl.integer(164, 80, 75),
    shading: 'stone',
  },
} as const satisfies KnotData
