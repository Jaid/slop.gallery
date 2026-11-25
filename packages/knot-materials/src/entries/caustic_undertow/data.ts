import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 3gQGAbAm59HYY8k; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'caustic_undertow',
  candidateId: 'claude_haiku',
  title: 'Caustic Undertow',
  createdAt: 1_791_758_567,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Sunlight braided by moving water is written across the drowned knot, and the net tightens into sharp light whenever you lean closer.',
  placeholder: {
    color: hsl.integer(223, 84, 43),
    shading: 'glass',
  },
} as const satisfies KnotData
