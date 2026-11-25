import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cryolite_fracture',
  candidateId: 'claude_opus',
  title: 'Cryolite Fracture',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Blue silence splinters into planes of borrowed daylight.',
  placeholder: {
    color: hsl.integer(243, 100, 77),
    shading: 'glass',
  },
} as const satisfies KnotData
