import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'birefringent_glacier',
  candidateId: 'grok',
  title: 'Birefringent Glacier',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A frozen passage splits the daylight into neighboring worlds.',
  placeholder: {
    color: hsl.integer(237, 100, 83),
    shading: 'glass',
  },
} as const satisfies KnotData
