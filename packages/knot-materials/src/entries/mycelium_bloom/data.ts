import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelium_bloom',
  candidateId: 'deepseek',
  title: 'Mycelium Bloom',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'The hidden garden flowers wherever its threads find one another.',
  placeholder: {
    color: hsl.integer(177, 100, 88.5),
    shading: 'fabric',
  },
} as const satisfies KnotData
