import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cinnabar_oracle',
  candidateId: 'grok',
  title: 'Cinnabar Oracle',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Answers gather in red lacquer, but only while you look away.',
  placeholder: {
    color: hsl.integer(30, 100, 61.8),
    shading: 'smooth',
  },
} as const satisfies KnotData
