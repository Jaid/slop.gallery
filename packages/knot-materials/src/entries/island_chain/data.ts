import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'island_chain',
  candidateId: 'deepseek',
  title: 'Island Chain',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Where the field closes on itself three times for every two turns, it tears the hot gas into islands, and every island sings.',
  placeholder: {
    color: hsl.integer(72, 19, 28),
    shading: 'metal',
  },
} as const satisfies KnotData
