import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_prominence',
  candidateId: 'deepseek',
  title: 'Solar Prominence',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'A loop of incandescent matter hangs above an unseen sun.',
  placeholder: {
    color: hsl.integer(49, 100, 67.9),
    shading: 'liquid',
  },
} as const satisfies KnotData
