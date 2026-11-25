import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tide_nacre',
  candidateId: 'grok',
  title: 'Tide Nacre',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Pearl keeps the slow rhythm of a tide long after the water has withdrawn.',
  placeholder: {
    color: hsl.integer(177, 75, 86),
    shading: 'glass',
  },
} as const satisfies KnotData
