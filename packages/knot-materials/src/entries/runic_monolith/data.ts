import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'runic_monolith',
  candidateId: 'kimi',
  title: 'Runic Monolith',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Old marks glow on a stone whose language seems older than its maker.',
  placeholder: {
    color: hsl.integer(172, 99, 88),
    shading: 'smooth',
  },
} as const satisfies KnotData
