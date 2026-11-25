import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'wraith_glass',
  candidateId: 'claude_sonnet',
  title: 'Wraith Glass',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Claude Sonnet 5',
    },
  },
  flavorText: 'A pale presence moves through glass that seems reluctant to hold a reflection.',
  placeholder: {
    color: hsl.integer(244, 100, 91),
    shading: 'ghost',
  },
} as const satisfies KnotData
