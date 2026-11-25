import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'boreal_curtain',
  candidateId: 'glm',
  title: 'Aurora Veil',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: 'A green hush drifts across the opening between earth and sky.',
  placeholder: {
    color: hsl.integer(163, 100, 88.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
