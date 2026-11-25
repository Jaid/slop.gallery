import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mercury_swell',
  candidateId: 'deepseek',
  title: 'Mercury Swell',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A metal that forgot how to be solid and now only remembers how to reflect.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(251, 12, 74),
    shading: 'metal',
  },
} as const satisfies KnotData
