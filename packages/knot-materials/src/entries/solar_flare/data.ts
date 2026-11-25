import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_flare',
  candidateId: 'deepseek',
  title: 'Solar Flare',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'A bright lash of stellar fire curls back toward the place that made it.',
  placeholder: {
    color: hsl.integer(86, 100, 86),
    shading: 'liquid',
  },
} as const satisfies KnotData
