import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'stained_requiem',
  candidateId: 'claude_sonnet',
  title: 'Stained Requiem',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'Colored glass holds the last notes of a song after the room has fallen quiet.',
  placeholder: {
    color: hsl.integer(327, 85, 59),
    shading: 'smooth',
  },
} as const satisfies KnotData
