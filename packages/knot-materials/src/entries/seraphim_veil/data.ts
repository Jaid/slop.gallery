import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'seraphim_veil',
  candidateId: 'gpt_sol',
  title: 'Seraphim Veil',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'Pale radiance folds into something almost feathered at the edge of sight.',
  placeholder: {
    color: hsl.integer(80, 100, 92.4),
    shading: 'glass',
  },
} as const satisfies KnotData
