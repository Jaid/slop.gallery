import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lunar_silk',
  candidateId: 'deepseek',
  title: 'Lunar Silk',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Woven from the cold side of the moon, it changes color with every step you take around it.',
  displacement: 0.0004,
  placeholder: {
    color: hsl.integer(268, 68, 18),
    shading: 'fabric',
  },
} as const satisfies KnotData
