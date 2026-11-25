import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chromatic_reef',
  candidateId: 'deepseek',
  title: 'Chromatic Reef',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'A reef of restless color grows beyond the charted spectrum.',
  placeholder: {
    color: hsl.integer(345, 100, 70),
    shading: 'smooth',
  },
} as const satisfies KnotData
