import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vitrail',
  candidateId: 'mimo',
  title: 'Vitrail',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A cathedral window poured through a knot; its jeweled panes still burn with the last of the sunset.',
  displacement: 0.005,
  placeholder: {
    color: hsl.integer(304, 68, 41),
    shading: 'glass',
  },
} as const satisfies KnotData
