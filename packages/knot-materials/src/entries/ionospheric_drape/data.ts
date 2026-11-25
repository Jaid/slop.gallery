import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ionospheric_drape',
  candidateId: 'kimi',
  title: 'Aurora Veil',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'The upper atmosphere lets down a curtain of drifting green fire.',
  placeholder: {
    color: hsl.integer(161, 84, 84),
    shading: 'smooth',
  },
} as const satisfies KnotData
