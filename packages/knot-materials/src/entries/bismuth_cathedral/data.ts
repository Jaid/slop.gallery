import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_cathedral',
  candidateId: 'deepseek',
  title: 'Bismuth Cathedral',
  createdAt: 1_789_949_253,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The metal grew in steps, and each step caught a different color of the same white light.',
  displacement: 0.015,
  placeholder: {
    color: hsl.integer(311, 52, 60),
    shading: 'metal',
  },
} as const satisfies KnotData
