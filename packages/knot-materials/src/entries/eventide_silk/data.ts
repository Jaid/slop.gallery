import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'eventide_silk',
  candidateId: 'qwen_max',
  title: 'Eventide Silk',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'The last colors of evening settle into a weightless fold.',
  placeholder: {
    color: hsl.integer(16, 86, 57.3),
    shading: 'fabric',
  },
} as const satisfies KnotData
