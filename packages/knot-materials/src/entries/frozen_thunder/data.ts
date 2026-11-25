import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'frozen_thunder',
  candidateId: 'claude_sonnet',
  title: 'Frozen Thunder',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Lightning struck once, and the glass kept the shape of it. Look closer and something inside is still running along the branches.',
  placeholder: {
    color: hsl.integer(273, 68, 7),
    shading: 'glass',
  },
} as const satisfies KnotData
