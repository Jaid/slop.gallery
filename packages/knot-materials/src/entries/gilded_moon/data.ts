import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1o1ree11eGriGjv; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'gilded_moon',
  candidateId: 'claude_sonnet',
  title: 'Gilded Moon',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'It shattered once, and was mended in gold. Now every wound is the brightest thing in the room.',
  placeholder: {
    color: hsl.integer(86, 15, 62),
    shading: 'smooth',
  },
} as const satisfies KnotData
