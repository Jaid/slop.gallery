import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opaline_dream',
  candidateId: 'deepseek',
  title: 'Opaline Dream',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A rain of ancient light, caught in stone and taught to remember every color it has ever been.',
  placeholder: {
    color: hsl.integer(296, 46, 21),
    shading: 'glass',
  },
} as const satisfies KnotData
