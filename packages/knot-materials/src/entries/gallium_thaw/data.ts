import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gallium_thaw',
  candidateId: 'grok',
  title: 'Gallium Thaw',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Metal softens at the edge of a warmth it seems to recognize.',
  placeholder: {
    color: hsl.integer(251, 25, 89),
    shading: 'liquid',
  },
} as const satisfies KnotData
