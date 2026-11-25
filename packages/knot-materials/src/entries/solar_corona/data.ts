import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_corona',
  candidateId: 'deepseek',
  title: 'Solar Corona',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A knot of the sun’s surface, where every cell of plasma is a convection current older than the sea.',
  displacement: 0.003,
  placeholder: {
    color: hsl.integer(50, 90, 59),
    shading: 'smooth',
  },
} as const satisfies KnotData
