import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'meissner_core',
  candidateId: 'kimi',
  title: 'Meissner Core',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'The cold heart holds the field at a distance, making absence tangible.',
  placeholder: {
    color: hsl.integer(239, 100, 83.3),
    shading: 'smooth',
  },
} as const satisfies KnotData
