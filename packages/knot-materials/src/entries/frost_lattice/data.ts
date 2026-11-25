import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frost_lattice',
  candidateId: 'claude_sonnet',
  title: 'Frost Lattice',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Cold has given the air a delicate, repeating skeleton.',
  placeholder: {
    color: hsl.integer(246, 100, 90.7),
    shading: 'glass',
  },
  displacement: 0.004,
} as const satisfies KnotData
