import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_ribbon',
  candidateId: 'kimi',
  title: 'Aurora Veil',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'A strip of northern sky slips loose from the horizon.',
  placeholder: {
    color: hsl.integer(167, 100, 89.9),
    shading: 'smooth',
  },
} as const satisfies KnotData
