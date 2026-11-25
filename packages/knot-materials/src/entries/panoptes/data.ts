import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'panoptes',
  candidateId: 'claude_sonnet',
  title: 'Panoptes',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'A hundred lidded watchers drift open as you draw near, and every one of them has already decided where you stand.',
  placeholder: {
    color: hsl.integer(170, 75, 34),
    shading: 'smooth',
  },
} as const satisfies KnotData
