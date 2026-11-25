import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cataphote_rouge',
  candidateId: 'gpt_astra',
  title: 'Cataphote Rouge',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A red glimmer returns to the place your gaze began.',
  placeholder: {
    color: hsl.integer(32, 96, 59.4),
    shading: 'smooth',
  },
} as const satisfies KnotData
