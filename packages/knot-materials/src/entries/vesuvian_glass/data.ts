import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vesuvian_glass',
  candidateId: 'glm',
  title: 'Vesuvian Glass',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: 'A volcanic night has cooled into a vessel that still seems warm inside.',
  placeholder: {
    color: hsl.integer(42, 100, 68),
    shading: 'glass',
  },
} as const satisfies KnotData
