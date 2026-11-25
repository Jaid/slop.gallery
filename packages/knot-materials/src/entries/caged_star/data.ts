import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'caged_star',
  candidateId: 'glm',
  title: 'Caged Star',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Its vessel is small; the fire inside has never noticed.',
  placeholder: {
    color: hsl.integer(72, 100, 79.1),
    shading: 'smooth',
  },
} as const satisfies KnotData
