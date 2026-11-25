import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_veil',
  candidateId: 'deepseek',
  title: 'Abyssal Veil',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.008,
  flavorText: 'Something that lives where the light is made instead of received.',
  placeholder: {
    color: hsl.integer(197, 93, 51),
    shading: 'glass',
  },
} as const satisfies KnotData
