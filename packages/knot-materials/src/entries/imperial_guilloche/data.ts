import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'imperial_guilloche',
  candidateId: 'claude_opus',
  title: 'Imperial Guilloché',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Under a lake of raspberry glass, gold was turned on a rose engine by patient hands. The lines still catch fire, and somewhere inside a small clock is ticking.',
  placeholder: {
    color: hsl.integer(18, 90, 16),
    shading: 'metal',
  },
} as const satisfies KnotData
