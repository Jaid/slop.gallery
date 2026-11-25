import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'polar_opal',
  candidateId: 'grok',
  title: 'Polar Opal',
  createdAt: 1_789_231_507,
  harness: 'grok.com',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Winter light moves inside the stone as though the horizon were trapped there.',
  placeholder: {
    color: hsl.integer(340, 100, 72.4),
    shading: 'glass',
  },
} as const satisfies KnotData
