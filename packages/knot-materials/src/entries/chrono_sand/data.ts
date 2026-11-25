import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chrono_sand',
  candidateId: 'qwen_max',
  title: 'Chrono Amber',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'Time slips through these grains without ever reaching the bottom.',
  placeholder: {
    color: hsl.integer(90, 100, 84),
    shading: 'smooth',
  },
} as const satisfies KnotData
