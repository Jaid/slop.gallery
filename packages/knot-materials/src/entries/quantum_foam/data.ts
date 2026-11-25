import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quantum_foam',
  candidateId: 'deepseek',
  title: 'Quantum Foam',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'A restless froth suggests that even empty space has a weather of its own.',
  placeholder: {
    color: hsl.integer(296, 100, 75),
    shading: 'liquid',
  },
} as const satisfies KnotData
