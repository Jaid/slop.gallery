import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'coral_bloom',
  candidateId: 'claude_sonnet',
  title: 'Coral Bloom',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'A submerged garden opens one luminous branch at a time.',
  placeholder: {
    color: hsl.integer(2, 100, 72.4),
    shading: 'fabric',
  },
} as const satisfies KnotData
