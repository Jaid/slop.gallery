import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'harlequin_opal',
  candidateId: 'kimi',
  title: 'Harlequin Opal',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'A hidden carnival changes its masks with every passing glance.',
  placeholder: {
    color: hsl.integer(336, 100, 83),
    shading: 'glass',
  },
} as const satisfies KnotData
