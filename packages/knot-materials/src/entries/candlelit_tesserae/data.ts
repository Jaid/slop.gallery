import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'candlelit_tesserae',
  candidateId: 'claude_sonnet',
  title: 'Candlelit Tesserae',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ten thousand glass petals, each tilted by a mason’s thumb. Carry a candle past them and the whole vault remembers how to burn.',
  placeholder: {
    color: hsl.integer(79, 87, 72.6),
    shading: 'metal',
  },
} as const satisfies KnotData
