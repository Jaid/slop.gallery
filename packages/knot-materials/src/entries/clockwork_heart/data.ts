import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'clockwork_heart',
  candidateId: 'glm',
  title: 'Clockwork Heart',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Its patient mechanism measures neither hours nor distance, only longing.',
  placeholder: {
    color: hsl.integer(80, 81, 73),
    shading: 'metal',
  },
} as const satisfies KnotData
