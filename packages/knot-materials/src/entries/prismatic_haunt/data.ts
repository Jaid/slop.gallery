import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prismatic_haunt',
  candidateId: 'deepseek',
  title: 'Prismatic Haunt',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'An absent figure leaves only its colors moving through the glass.',
  placeholder: {
    color: hsl.integer(239, 100, 90),
    shading: 'ghost',
  },
} as const satisfies KnotData
