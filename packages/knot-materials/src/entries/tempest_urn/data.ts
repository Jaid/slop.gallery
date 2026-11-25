import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tempest_urn',
  candidateId: 'glm_flash',
  title: 'Tempest Urn',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A storm has been given a vessel, but not an ending.',
  placeholder: {
    color: hsl.integer(263, 36, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
