import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chronal_amber',
  candidateId: 'qwen_max',
  title: 'Chronal Amber',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'A single instant thickens into honey and refuses to pass.',
  placeholder: {
    color: hsl.integer(59, 100, 71),
    shading: 'glass',
  },
} as const satisfies KnotData
