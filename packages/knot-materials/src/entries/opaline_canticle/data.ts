import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opaline_canticle',
  candidateId: 'deepseek',
  title: 'Opaline Canticle',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Milk that keeps a different rainbow for every direction you look, sung by lattices of glass no eye can see.',
  placeholder: {
    color: hsl.integer(271, 100, 86),
    shading: 'glass',
  },
} as const satisfies KnotData
