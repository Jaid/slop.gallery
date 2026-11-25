import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gossamer_dew',
  candidateId: 'grok',
  title: 'Gossamer Dew',
  createdAt: 1_789_231_507,
  harness: 'grok.com',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Small droplets make constellations along a nearly invisible thread.',
  placeholder: {
    color: hsl.integer(245, 100, 92),
    shading: 'fabric',
  },
} as const satisfies KnotData
