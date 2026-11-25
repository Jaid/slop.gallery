import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ferrofluidic_resonance',
  candidateId: 'qwen_max',
  title: 'Ferrofluidic Resonance',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'An unseen rhythm combs the liquid into trembling order.',
  placeholder: {
    color: hsl.integer(350, 100, 60.4),
    shading: 'liquid',
  },
} as const satisfies KnotData
