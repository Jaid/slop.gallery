import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mercury_mirror',
  candidateId: 'deepseek',
  title: 'Mercury Mirror',
  createdAt: 1_789_949_253,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Nothing is so still as a mirror, and nothing so restless as the hand that holds it.',
  placeholder: {
    color: hsl.integer(244, 13, 83),
    shading: 'liquid',
  },
} as const satisfies KnotData
