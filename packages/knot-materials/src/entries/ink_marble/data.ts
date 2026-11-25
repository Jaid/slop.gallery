import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ink_marble',
  candidateId: 'claude_sonnet',
  title: 'Ink Marble',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Dark ink wanders through pale stone as though the page were still wet.',
  placeholder: {
    color: hsl.integer(284, 26, 19),
    shading: 'smooth',
  },
} as const satisfies KnotData
