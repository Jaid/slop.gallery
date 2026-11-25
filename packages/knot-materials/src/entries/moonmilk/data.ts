import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'moonmilk',
  candidateId: 'mimo',
  title: 'Moonmilk',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Layers of shell remember the moon, and hand its borrowed light back to you in slow tides of pearl.',
  placeholder: {
    color: hsl.integer(79, 31, 87),
    shading: 'smooth',
  },
} as const satisfies KnotData
