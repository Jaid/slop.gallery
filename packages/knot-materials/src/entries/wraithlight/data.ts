import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'wraithlight',
  candidateId: 'deepseek',
  title: 'Wraithlight',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'A wandering glow lingers where a solid object ought to be.',
  placeholder: {
    color: hsl.integer(223, 100, 92),
    shading: 'ghost',
  },
} as const satisfies KnotData
