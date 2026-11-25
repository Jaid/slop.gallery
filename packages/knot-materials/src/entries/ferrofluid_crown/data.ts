import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferrofluid_crown',
  candidateId: 'kimi',
  title: 'Ferrofluid Crown',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Liquid points gather into a coronation that never quite becomes solid.',
  placeholder: {
    color: hsl.integer(275, 100, 59),
    shading: 'liquid',
  },
} as const satisfies KnotData
