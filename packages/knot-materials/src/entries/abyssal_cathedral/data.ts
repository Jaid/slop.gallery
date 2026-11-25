import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_cathedral',
  candidateId: 'deepseek',
  title: 'Abyssal Cathedral',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'The drowned nave still gathers light for a congregation of currents.',
  placeholder: {
    color: hsl.integer(206, 83, 72),
    shading: 'smooth',
  },
} as const satisfies KnotData
