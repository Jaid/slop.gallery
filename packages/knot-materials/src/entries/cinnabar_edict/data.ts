import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cinnabar_edict',
  candidateId: 'grok',
  title: 'Cinnabar Edict',
  createdAt: 1_789_231_507,
  harness: 'grok.com',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A vermilion seal preserves an order whose kingdom has vanished.',
  placeholder: {
    color: hsl.integer(29, 98, 51.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
