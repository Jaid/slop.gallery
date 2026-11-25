import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cymatic_resonance',
  candidateId: 'qwen_max',
  title: 'Cymatic Resonance',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'An inaudible chord draws its signature across the surface.',
  placeholder: {
    color: hsl.integer(91, 82, 73),
    shading: 'smooth',
  },
} as const satisfies KnotData
