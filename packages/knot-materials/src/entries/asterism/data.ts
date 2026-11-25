import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'asterism',
  candidateId: 'deepseek',
  title: 'Asterism',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A six-rayed star sleeps inside the blue stone, and wakes only for the light that finds it.',
  placeholder: {
    color: hsl.integer(263, 79, 34),
    shading: 'glass',
  },
} as const satisfies KnotData
