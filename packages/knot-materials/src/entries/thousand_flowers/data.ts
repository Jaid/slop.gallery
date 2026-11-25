import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 8EWpDkWx6nfkCqt; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'thousand_flowers',
  candidateId: 'claude_sonnet',
  title: 'Thousand Flowers',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'A garden was drawn into glass rods, sliced thin as coins and sealed in crystal. Walk past and the blossoms drift apart at three depths.',
  placeholder: {
    color: hsl.integer(228, 84, 30),
    shading: 'glass',
  },
} as const satisfies KnotData
