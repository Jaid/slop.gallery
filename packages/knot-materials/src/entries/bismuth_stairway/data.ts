import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_stairway',
  candidateId: 'glm',
  title: 'Bismuth Stairway',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: 'Iridescent steps climb toward a landing that never arrives.',
  placeholder: {
    color: hsl.integer(337, 100, 79),
    shading: 'metal',
  },
} as const satisfies KnotData
