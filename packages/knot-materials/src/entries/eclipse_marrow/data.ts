import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'eclipse_marrow',
  candidateId: 'grok',
  title: 'Eclipse Marrow',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'The dark heart of an eclipse keeps a thin reserve of sunlight.',
  placeholder: {
    color: hsl.integer(41, 99, 71),
    shading: 'smooth',
  },
} as const satisfies KnotData
