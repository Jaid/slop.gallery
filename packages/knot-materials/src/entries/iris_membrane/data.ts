import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'iris_membrane',
  candidateId: 'claude_opus',
  title: 'Iris Membrane',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A thin skin of color seems to narrow around your gaze.',
  placeholder: {
    color: hsl.integer(302.4, 100, 62),
    shading: 'glass',
  },
} as const satisfies KnotData
