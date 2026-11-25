import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'silver_slipstream',
  candidateId: 'glm',
  title: 'Silver Slipstream',
  createdAt: 1_790_036_112,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: 'Every reflection finds a different route across this slippery silver skin.',
  placeholder: {
    color: hsl.integer(251, 34, 91.5),
    shading: 'liquid',
  },
} as const satisfies KnotData
