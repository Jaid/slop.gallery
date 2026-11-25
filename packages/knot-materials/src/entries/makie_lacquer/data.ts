import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'makie_lacquer',
  candidateId: 'claude_fable',
  title: 'Maki-e Lacquer',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Gold dust settles into deep lacquer like stars into a still night.',
  placeholder: {
    color: hsl.integer(86, 86, 82),
    shading: 'smooth',
  },
} as const satisfies KnotData
