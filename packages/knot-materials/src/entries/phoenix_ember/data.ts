import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'phoenix_ember',
  candidateId: 'kimi',
  title: 'Phoenix Ember',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'A coal bright enough to suggest that the ending was only another beginning.',
  placeholder: {
    color: hsl.integer(68, 99, 79.4),
    shading: 'smooth',
  },
} as const satisfies KnotData
