import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'watching_stone',
  candidateId: 'claude_opus',
  title: 'Watching Stone',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Gold silk sleeps in the quartz until someone passes. Then a slow bright eye opens along the stone and follows them out of the room.',
  placeholder: {
    color: hsl.integer(59, 90, 43),
    shading: 'stone',
  },
} as const satisfies KnotData
