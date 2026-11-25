import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'blushing_matter',
  candidateId: 'gpt_astra',
  title: 'Blushing Matter',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'This unfamiliar substance seems embarrassed by your attention.',
  placeholder: {
    color: hsl.integer(9, 85, 66),
    shading: 'smooth',
  },
} as const satisfies KnotData
