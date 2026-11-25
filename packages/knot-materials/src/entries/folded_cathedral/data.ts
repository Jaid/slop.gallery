import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'folded_cathedral',
  candidateId: 'deepseek',
  title: 'Folded Cathedral',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Someone folded a cathedral into a ribbon and forgot to take the light out.',
  placeholder: {
    color: hsl.integer(350, 48, 37),
    shading: 'glass',
  },
} as const satisfies KnotData
