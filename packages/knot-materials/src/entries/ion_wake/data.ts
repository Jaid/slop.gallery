import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ion_wake',
  candidateId: 'grok',
  title: 'Ion Wake',
  createdAt: 1_789_231_507,
  harness: 'grok.com',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A passing charge leaves a bright trail in an otherwise silent medium.',
  placeholder: {
    color: hsl.integer(205, 100, 87),
    shading: 'smooth',
  },
} as const satisfies KnotData
