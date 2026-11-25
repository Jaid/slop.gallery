import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_hopper',
  candidateId: 'deepseek',
  title: 'Bismuth Hopper',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'Color descends a stairway that grows deeper with every reflection.',
  placeholder: {
    color: hsl.integer(256, 100, 79.6),
    shading: 'metal',
  },
} as const satisfies KnotData
