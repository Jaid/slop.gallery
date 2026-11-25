import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ion_cathedral',
  candidateId: 'glm_flash',
  title: 'Ion Cathedral',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Charged light gathers beneath arches drawn by an unseen current.',
  placeholder: {
    color: hsl.integer(296, 100, 59.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
