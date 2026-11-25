import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_leviathan',
  candidateId: 'qwen_max',
  title: 'Abyssal Leviathan',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'An ancient hide remembers the pressure of uncharted oceans.',
  placeholder: {
    color: hsl.integer(171, 100, 87),
    shading: 'smooth',
  },
} as const satisfies KnotData
