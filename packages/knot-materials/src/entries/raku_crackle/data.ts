import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'raku_crackle',
  candidateId: 'claude_opus',
  title: 'Raku Crackle',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Smoke has found every small opening left by the cooling glaze.',
  placeholder: {
    color: hsl.integer(194, 91, 40),
    shading: 'stone',
  },
} as const satisfies KnotData
