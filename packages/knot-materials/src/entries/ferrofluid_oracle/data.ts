import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferrofluid_oracle',
  candidateId: 'grok',
  title: 'Ferrofluid Oracle',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'The black pool raises its answer in a forest of shining spires.',
  placeholder: {
    color: hsl.integer(258, 26, 83),
    shading: 'liquid',
  },
  displacement: 0.095,
} as const satisfies KnotData
