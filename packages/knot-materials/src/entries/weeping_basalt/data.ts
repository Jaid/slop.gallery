import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'weeping_basalt',
  candidateId: 'gpt_sol',
  title: 'Weeping Basalt',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Dark stone lets a little of its buried heat escape in glowing tears.',
  placeholder: {
    color: hsl.integer(211, 50, 77),
    shading: 'stone',
  },
} as const satisfies KnotData
