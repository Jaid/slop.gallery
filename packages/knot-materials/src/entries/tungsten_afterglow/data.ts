import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tungsten_afterglow',
  candidateId: 'grok',
  title: 'Tungsten Afterglow',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'The lamp is gone, but its fine metal heart has not finished glowing.',
  placeholder: {
    color: hsl.integer(42, 99, 65),
    shading: 'metal',
  },
} as const satisfies KnotData
