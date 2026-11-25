import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_dawn',
  candidateId: 'glm',
  title: 'Kintsugi Dawn',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'The first light enters through the places that once broke.',
  placeholder: {
    color: hsl.integer(86, 85, 81),
    shading: 'stone',
  },
} as const satisfies KnotData
