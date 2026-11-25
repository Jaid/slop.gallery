import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_nocturne',
  candidateId: 'deepseek',
  title: 'Velvet Nocturne',
  createdAt: 1_789_949_253,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Face it and the cloth is almost black; walk past and the whole garment catches fire.',
  displacement: 0.032,
  placeholder: {
    color: hsl.integer(16, 89, 21),
    shading: 'fabric',
  },
} as const satisfies KnotData
