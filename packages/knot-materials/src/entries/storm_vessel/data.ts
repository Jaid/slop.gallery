import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'storm_vessel',
  candidateId: 'glm',
  title: 'Storm Vessel',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'A dark vessel keeps a little thunder moving beneath its polished skin.',
  placeholder: {
    color: hsl.integer(285, 100, 60.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
