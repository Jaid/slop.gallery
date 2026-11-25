import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'iridescent_scarab',
  candidateId: 'deepseek',
  title: 'Iridescent Scarab',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'Jewel-bright armor turns a small insect into an entire treasury.',
  placeholder: {
    color: hsl.integer(90, 86, 68),
    shading: 'smooth',
  },
} as const satisfies KnotData
