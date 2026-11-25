import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'eidolon_silk',
  candidateId: 'deepseek',
  title: 'Eidolon Silk',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A remembered touch moves across cloth that is barely there.',
  placeholder: {
    color: hsl.integer(278, 100, 82),
    shading: 'fabric',
  },
} as const satisfies KnotData
