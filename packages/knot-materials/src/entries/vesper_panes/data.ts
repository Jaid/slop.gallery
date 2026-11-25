import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'vesper_panes',
  candidateId: 'claude_sonnet',
  title: 'Vesper Panes',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Evening pours through a thousand patient panes. Each one keeps a different hour, and none of them forgives the dark.',
  placeholder: {
    color: hsl.integer(264.8, 98, 41.7),
    shading: 'glass',
  },
} as const satisfies KnotData
