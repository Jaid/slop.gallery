import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nebula_glass',
  candidateId: 'qwen_max',
  title: 'Stellar Nursery',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'A cloud of distant stars drifts through a vessel of clear night.',
  placeholder: {
    color: hsl.integer(350, 100, 60.4),
    shading: 'glass',
  },
} as const satisfies KnotData
