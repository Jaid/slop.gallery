import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'midnight_opal',
  candidateId: 'glm_flash',
  title: 'Midnight Opal',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A few late colors remain awake inside a stone made of midnight.',
  placeholder: {
    color: hsl.integer(166, 100, 87.9),
    shading: 'glass',
  },
} as const satisfies KnotData
