import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bioluminescent_veins',
  candidateId: 'claude_sonnet',
  title: 'Bioluminescent Veins',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A quiet pulse carries starlight through a body made of night.',
  placeholder: {
    color: hsl.integer(170, 100, 87),
    shading: 'liquid',
  },
} as const satisfies KnotData
