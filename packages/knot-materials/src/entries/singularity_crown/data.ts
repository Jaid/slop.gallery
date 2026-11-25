import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'singularity_crown',
  candidateId: 'glm',
  title: 'Event Horizon',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'GLM 5.3',
      slug: 'z-ai/glm-5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Light bends around a dark sovereign that never needs to show its face.',
  placeholder: {
    color: hsl.integer(68, 100, 79),
    shading: 'ghost',
  },
} as const satisfies KnotData
