import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'captured_lightning',
  candidateId: 'deepseek',
  title: 'Captured Lightning',
  createdAt: 1_789_987_251,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A hundred thousand volts passed through the resin one night, and left its portrait behind.',
  placeholder: {
    color: hsl.integer(253, 66, 46),
    shading: 'glass',
  },
} as const satisfies KnotData
