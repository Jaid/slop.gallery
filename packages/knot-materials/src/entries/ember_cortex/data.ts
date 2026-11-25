import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ember_cortex',
  candidateId: 'glm_flash',
  title: 'Ember Cortex',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3 Flash',
      slug: 'z-ai/glm-5.3-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Old thoughts flare briefly through the branching folds of a coal.',
  placeholder: {
    color: hsl.integer(37.7, 100, 63),
    shading: 'smooth',
  },
} as const satisfies KnotData
