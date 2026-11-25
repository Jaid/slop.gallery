import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quantum_superposition',
  candidateId: 'qwen_max',
  title: 'Quantum Superposition',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'The object offers several versions of itself, none willing to become the only one.',
  placeholder: {
    color: hsl.integer(248, 99, 68),
    shading: 'ghost',
  },
} as const satisfies KnotData
