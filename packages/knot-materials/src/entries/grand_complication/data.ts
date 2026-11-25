import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 8EWpDkWx6nfkCqt; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'grand_complication',
  candidateId: 'claude_sonnet',
  title: 'Grand Complication',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Hundreds of gears no bigger than a thumbnail keep an exact appointment with nothing, ticking in gold above a blue abyss of steel.',
  placeholder: {
    color: hsl.integer(80, 80, 76),
    shading: 'metal',
  },
} as const satisfies KnotData
