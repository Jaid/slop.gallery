import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prism_cascade',
  candidateId: 'deepseek',
  title: 'Prism Cascade',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'Daylight falls through a series of colors it did not know it contained.',
  placeholder: {
    color: hsl.integer(343, 100, 82),
    shading: 'glass',
  },
} as const satisfies KnotData
