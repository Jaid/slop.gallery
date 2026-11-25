import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'harlequin_awakening',
  candidateId: 'claude_sonnet',
  title: 'Harlequin Awakening',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Fire sleeps in the stone. Turn your head and a thousand small suns wake, each answering to its own angle.',
  placeholder: {
    color: hsl.integer(264, 64, 10.5),
    shading: 'glass',
  },
} as const satisfies KnotData
