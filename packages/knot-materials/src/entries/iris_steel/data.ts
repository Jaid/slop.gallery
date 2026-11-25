import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'iris_steel',
  candidateId: 'grok',
  title: 'Iris Steel',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'The metal opens a colored eye each time the light moves.',
  placeholder: {
    color: hsl.integer(267, 100, 75),
    shading: 'metal',
  },
} as const satisfies KnotData
