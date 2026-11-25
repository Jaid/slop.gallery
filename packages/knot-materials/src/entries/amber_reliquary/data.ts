import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_reliquary',
  candidateId: 'mimo',
  title: 'Amber Reliquary',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Forty million years of sunlight, bottled. A fern, a midge, a held breath – all of it still waiting for the dawn.',
  placeholder: {
    color: hsl.integer(65, 79, 59),
    shading: 'glass',
  },
} as const satisfies KnotData
