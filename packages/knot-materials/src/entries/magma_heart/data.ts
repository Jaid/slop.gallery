import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'magma_heart',
  candidateId: 'kimi',
  title: 'Magma Heart',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Beneath the dark crust, the mountain keeps its own slow heartbeat.',
  placeholder: {
    color: hsl.integer(37, 100, 61.4),
    shading: 'liquid',
  },
} as const satisfies KnotData
