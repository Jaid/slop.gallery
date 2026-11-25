import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'honey_relic',
  candidateId: 'grok',
  title: 'Honey Relic',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Warm amber guards a sweetness older than the flowers that made it.',
  placeholder: {
    color: hsl.integer(72, 100, 79.1),
    shading: 'smooth',
  },
} as const satisfies KnotData
