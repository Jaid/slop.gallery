import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'photon_weave',
  candidateId: 'glm_flash',
  title: 'Photon Weave',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Light threads itself through a fabric with no ordinary fibers.',
  placeholder: {
    color: hsl.integer(87, 100, 85.2),
    shading: 'fabric',
  },
} as const satisfies KnotData
