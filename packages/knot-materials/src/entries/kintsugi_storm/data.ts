import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_storm',
  candidateId: 'grok',
  title: 'Kintsugi Storm',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Lightning finds every old fracture and stitches it briefly with gold.',
  placeholder: {
    color: hsl.integer(88, 100, 87),
    shading: 'stone',
  },
} as const satisfies KnotData
