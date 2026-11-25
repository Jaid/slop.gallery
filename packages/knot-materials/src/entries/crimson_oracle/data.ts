import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'crimson_oracle',
  candidateId: 'gpt_sol',
  title: 'Crimson Oracle',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'A red ember offers a different omen from every angle.',
  placeholder: {
    color: hsl.integer(27, 100, 67),
    shading: 'smooth',
  },
} as const satisfies KnotData
