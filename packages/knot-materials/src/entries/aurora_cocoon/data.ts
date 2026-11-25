import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_cocoon',
  candidateId: 'glm_flash',
  title: 'Aurora Cocoon',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A sleeping dawn waits inside its own luminous wrapping.',
  placeholder: {
    color: hsl.integer(161, 100, 87),
    shading: 'smooth',
  },
} as const satisfies KnotData
