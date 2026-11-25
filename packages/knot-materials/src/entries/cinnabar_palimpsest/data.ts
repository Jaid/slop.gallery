import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cinnabar_palimpsest',
  candidateId: 'grok',
  title: 'Cinnabar Palimpsest',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Older messages rise through the red surface of a forgotten inscription.',
  placeholder: {
    color: hsl.integer(30, 93, 54),
    shading: 'smooth',
  },
} as const satisfies KnotData
