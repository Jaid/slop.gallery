import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'drowned_basilica',
  candidateId: 'deepseek',
  title: 'Sunken Cathedral',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'Water passes through the arches where bells once held the air.',
  placeholder: {
    color: hsl.integer(224, 99, 78),
    shading: 'smooth',
  },
} as const satisfies KnotData
