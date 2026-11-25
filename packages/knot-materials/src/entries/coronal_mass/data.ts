import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'coronal_mass',
  candidateId: 'qwen_max',
  title: 'Coronal Mass',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'A fragment of the sun carries the shape of its escape.',
  placeholder: {
    color: hsl.integer(49, 100, 67),
    shading: 'smooth',
  },
} as const satisfies KnotData
