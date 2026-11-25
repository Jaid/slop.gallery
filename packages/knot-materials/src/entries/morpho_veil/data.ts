import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'morpho_veil',
  candidateId: 'glm_flash',
  title: 'Morpho Veil',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: "A butterfly's impossible blue passes across a nearly weightless surface.",
  placeholder: {
    color: hsl.integer(263, 100, 56),
    shading: 'glass',
  },
} as const satisfies KnotData
