import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'helios_forge',
  candidateId: 'deepseek',
  title: 'Helios Forge',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: "The sun's workshop leaves bright filings along every curve.",
  placeholder: {
    color: hsl.integer(72, 100, 79.1),
    shading: 'smooth',
  },
} as const satisfies KnotData
