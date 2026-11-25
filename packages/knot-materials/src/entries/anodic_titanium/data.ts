import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'anodic_titanium',
  candidateId: 'claude_opus',
  title: 'Anodic Titanium',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A thin breath of color lies over metal that refuses to age.',
  placeholder: {
    color: hsl.integer(262, 50, 59),
    shading: 'metal',
  },
} as const satisfies KnotData
