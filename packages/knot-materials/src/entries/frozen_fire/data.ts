import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frozen_fire',
  candidateId: 'mimo',
  title: 'Frozen Fire',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An opal dreams in patches of fire; every step you take rewrites the spectrum it has kept for a million years.',
  placeholder: {
    color: hsl.integer(273, 13, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
