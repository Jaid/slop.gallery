import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'frostbound_ember',
  candidateId: 'claude_opus',
  title: 'Frostbound Ember',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Winter sealed a small fire inside the ice. Stand close, and the warmth of your body opens a window for it.',
  placeholder: {
    color: hsl.integer(252, 37, 81),
    shading: 'glass',
  },
} as const satisfies KnotData
