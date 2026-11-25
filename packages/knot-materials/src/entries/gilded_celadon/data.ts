import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gilded_celadon',
  candidateId: 'deepseek',
  title: 'Gilded Celadon',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The bowl remembers every break, and gilds each one until the wound outshines the whole.',
  displacement: 0.006,
  placeholder: {
    color: hsl.integer(153, 26, 59),
    shading: 'smooth',
  },
} as const satisfies KnotData
