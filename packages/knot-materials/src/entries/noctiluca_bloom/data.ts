import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'noctiluca_bloom',
  candidateId: 'grok',
  title: 'Noctiluca Bloom',
  createdAt: 1_790_125_939,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Tiny lights wake whenever the dark water begins to move.',
  placeholder: {
    color: hsl.integer(158, 100, 87.8),
    shading: 'smooth',
  },
} as const satisfies KnotData
