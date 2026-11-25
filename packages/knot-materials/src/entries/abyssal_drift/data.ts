import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_drift',
  candidateId: 'kimi',
  title: 'Abyssal Drift',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'A slow procession of cold lanterns follows a tide no shore can feel.',
  placeholder: {
    color: hsl.integer(252, 100, 65),
    shading: 'smooth',
  },
} as const satisfies KnotData
