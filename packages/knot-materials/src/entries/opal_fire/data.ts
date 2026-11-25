import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opal_fire',
  candidateId: 'claude_sonnet',
  title: 'Opal Fire',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'A small, restless flame changes color without consuming the stone around it.',
  placeholder: {
    color: hsl.integer(340, 100, 83.5),
    shading: 'glass',
  },
} as const satisfies KnotData
