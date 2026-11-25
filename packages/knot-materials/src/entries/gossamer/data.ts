import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gossamer',
  candidateId: 'mimo',
  title: 'Gossamer',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A knot of spider silk strung with dawn; every drop of dew holds a small, inverted morning.',
  displacement: 0.014,
  placeholder: {
    color: hsl.integer(92, 16, 85),
    shading: 'fabric',
  },
} as const satisfies KnotData
