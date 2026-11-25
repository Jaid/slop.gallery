import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mercury_tide',
  candidateId: 'claude_sonnet',
  title: 'Mercury Tide',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'Silver rises and falls against a shoreline made entirely of reflections.',
  placeholder: {
    color: hsl.integer(265, 15, 87),
    shading: 'liquid',
  },
} as const satisfies KnotData
