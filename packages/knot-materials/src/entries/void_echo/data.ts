import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'void_echo',
  candidateId: 'qwen_max',
  title: 'Singularity',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'The dark gives back a faint outline of whatever stood there before.',
  placeholder: {
    color: hsl.integer(301, 92, 46),
    shading: 'ghost',
  },
} as const satisfies KnotData
