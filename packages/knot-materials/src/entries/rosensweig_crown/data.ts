import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'rosensweig_crown',
  candidateId: 'claude_sonnet',
  title: 'Rosensweig Crown',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'A pool of liquid night, bristling with obedient spikes. They rise toward whoever dares to bring a magnet near.',
  placeholder: {
    color: hsl.integer(273, 17, 10),
    shading: 'liquid',
  },
} as const satisfies KnotData
