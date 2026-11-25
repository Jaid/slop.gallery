import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'shatterlight',
  candidateId: 'deepseek',
  title: 'Shatterlight',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A mirror that was broken on purpose, then bound with gold, so every shard can keep a different piece of the room.',
  placeholder: {
    color: hsl.integer(261, 22, 77),
    shading: 'metal',
  },
} as const satisfies KnotData
