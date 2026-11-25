import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'heartwood_knot',
  candidateId: 'deepseek',
  title: 'Heartwood Knot',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A century of slow rain, cut open and polished until the light walks along it.',
  placeholder: {
    color: hsl.integer(45, 77, 25),
    shading: 'smooth',
  },
} as const satisfies KnotData
