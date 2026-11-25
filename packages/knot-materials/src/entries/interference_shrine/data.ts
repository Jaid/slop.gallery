import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'interference_shrine',
  candidateId: 'glm',
  title: 'Interference Shrine',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Crossing waves build a small sanctuary of impossible colors.',
  placeholder: {
    color: hsl.integer(233, 100, 75.7),
    shading: 'smooth',
  },
} as const satisfies KnotData
