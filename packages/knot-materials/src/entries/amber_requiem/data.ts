import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_requiem',
  candidateId: 'deepseek',
  title: 'Amber Requiem',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A golden tomb where one summer keeps its smallest citizens, perfectly still, forever.',
  placeholder: {
    color: hsl.integer(61, 87, 54),
    shading: 'glass',
  },
} as const satisfies KnotData
