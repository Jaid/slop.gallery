import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ghostwood',
  candidateId: 'qwen_max',
  title: 'Spirit Birch',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'The grain remembers a tree that no longer casts a shadow.',
  placeholder: {
    color: hsl.integer(250, 100, 95),
    shading: 'ghost',
  },
} as const satisfies KnotData
