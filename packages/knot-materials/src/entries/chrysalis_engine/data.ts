import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chrysalis_engine',
  candidateId: 'gpt_sol',
  title: 'Chrysalis Engine',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'Something mechanical is dreaming of the wings it will grow.',
  placeholder: {
    color: hsl.integer(177, 84, 84),
    shading: 'smooth',
  },
} as const satisfies KnotData
