import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quicksilver',
  candidateId: 'deepseek',
  title: 'Quicksilver',
  createdAt: 1_789_075_137,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.011,
  flavorText: 'It has no color of its own, so it borrows the room and gives it back.',
  placeholder: {
    color: hsl.integer(251, 12, 56),
    shading: 'liquid',
  },
} as const satisfies KnotData
