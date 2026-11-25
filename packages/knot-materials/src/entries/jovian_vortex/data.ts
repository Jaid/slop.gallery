import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'jovian_vortex',
  candidateId: 'claude_opus',
  title: 'Jovian Vortex',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A gas giant\'s soul wrapped around the knot, belts of ammonia cream shearing into watchful spirals.',
  displacement: 0.01,
  placeholder: {
    color: hsl.integer(57, 53, 63),
    shading: 'smooth',
  },
} as const satisfies KnotData
