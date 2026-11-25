import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'petrified_lightning',
  candidateId: 'qwen_max',
  title: 'Petrified Lightning',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'A thunderbolt has spent centuries learning the stillness of a mineral.',
  placeholder: {
    color: hsl.integer(238, 99, 85),
    shading: 'stone',
  },
} as const satisfies KnotData
