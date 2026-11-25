import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 3gQGAbAm59HYY8k; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'nodal_choir',
  candidateId: 'claude_haiku',
  title: 'Nodal Choir',
  createdAt: 1_791_758_567,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Sand flees the sounding places and settles only on the silent lines, sketching a song the bronze keeps humming to itself.',
  placeholder: {
    color: hsl.integer(76, 52, 59),
    shading: 'metal',
  },
} as const satisfies KnotData
