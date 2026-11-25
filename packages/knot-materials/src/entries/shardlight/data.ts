import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'shardlight',
  candidateId: 'deepseek',
  title: 'Shardlight',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A thousand mirrors agree to disagree about where the light comes from.',
  displacement: 0.005,
  placeholder: {
    color: hsl.integer(252, 18, 43),
    shading: 'metal',
  },
} as const satisfies KnotData
