import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ephemera',
  candidateId: 'deepseek',
  title: 'Ephemera',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A film of water one thousand atoms thick, holding every color of the sky for as long as it dares.',
  placeholder: {
    color: hsl.integer(228, 56, 78),
    shading: 'glass',
  },
} as const satisfies KnotData
