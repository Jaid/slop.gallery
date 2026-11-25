import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_cage',
  candidateId: 'deepseek',
  title: 'Aurora Cage',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'Northern light presses softly against the bars of its gilded prison.',
  placeholder: {
    color: hsl.integer(152.6, 100, 85.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
