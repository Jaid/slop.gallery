import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'graphene_weave',
  candidateId: 'claude_sonnet',
  title: 'Graphene Weave',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A dark fabric finds its strength in the spaces between its bonds.',
  placeholder: {
    color: hsl.integer(0, 0, 20.4),
    shading: 'fabric',
  },
} as const satisfies KnotData
