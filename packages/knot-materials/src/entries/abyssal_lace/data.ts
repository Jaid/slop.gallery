import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_lace',
  candidateId: 'claude_sonnet',
  title: 'Abyssal Lace',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Eight rows of living lace beat rainbows into the dark. Nothing here is lit from outside – the creature simply cannot help but shine.',
  placeholder: {
    color: hsl.integer(248, 83, 17),
    shading: 'glass',
  },
} as const satisfies KnotData
