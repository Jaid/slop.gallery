import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ventricle_glass',
  candidateId: 'grok',
  title: 'Ventricle Glass',
  createdAt: 1_789_231_507,
  harness: 'grok.com',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A transparent chamber turns a quiet pulse into a visible tide.',
  placeholder: {
    color: hsl.integer(15, 99, 62),
    shading: 'glass',
  },
} as const satisfies KnotData
