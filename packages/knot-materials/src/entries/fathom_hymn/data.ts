import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'fathom_hymn',
  candidateId: 'glm',
  title: 'Fathom Hymn',
  createdAt: 1_791_852_458,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'A chorus too deep to hear leaves its harmonies in living light.',
  placeholder: {
    color: hsl.integer(221, 100, 78),
    shading: 'smooth',
  },
} as const satisfies KnotData
