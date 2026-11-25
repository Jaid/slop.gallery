import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_ziggurat',
  candidateId: 'glm_flash',
  title: 'Bismuth Ziggurat',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A miniature citadel rises from the orderly dreams of cooling metal.',
  placeholder: {
    color: hsl.integer(332, 100, 79),
    shading: 'metal',
  },
  displacement: 0.055,
} as const satisfies KnotData
