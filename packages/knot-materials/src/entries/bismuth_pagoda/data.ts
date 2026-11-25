import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_pagoda',
  candidateId: 'glm',
  title: 'Bismuth Pagoda',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Metal builds a small temple from terraces of borrowed rainbows.',
  placeholder: {
    color: hsl.integer(339, 100, 78.7),
    shading: 'metal',
  },
  displacement: 0.045,
} as const satisfies KnotData
