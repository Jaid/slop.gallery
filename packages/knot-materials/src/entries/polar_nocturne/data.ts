import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'polar_nocturne',
  candidateId: 'glm',
  title: 'Polar Nocturne',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'The long night keeps its own music in bands of cold color.',
  placeholder: {
    color: hsl.integer(154, 100, 87.2),
    shading: 'smooth',
  },
} as const satisfies KnotData
