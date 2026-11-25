import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'amber_cosmos',
  candidateId: 'claude_sonnet',
  title: 'Amber Cosmos',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Forty million years of sunlight went into this resin and never came out. Small worlds of air still turn inside it, waiting for you to look deeper.',
  placeholder: {
    color: hsl.integer(62, 100, 74),
    shading: 'glass',
  },
} as const satisfies KnotData
