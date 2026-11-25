import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'asteria',
  candidateId: 'mimo',
  title: 'Asteria',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A small star is caught in the stone. Walk, and it walks with you, forever at the edge of your eye.',
  displacement: 0.001,
  placeholder: {
    color: hsl.integer(265, 71, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
