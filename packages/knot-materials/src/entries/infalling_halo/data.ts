import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'infalling_halo',
  candidateId: 'deepseek',
  title: 'Infalling Halo',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The last thing light does before it gives up is bend into a perfect circle.',
  displacement: 0.0012,
  placeholder: {
    color: hsl.integer(312, 40, 9),
    shading: 'smooth',
  },
} as const satisfies KnotData
