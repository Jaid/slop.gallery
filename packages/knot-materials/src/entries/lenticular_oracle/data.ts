import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'lenticular_oracle',
  candidateId: 'claude_sonnet',
  title: 'Lenticular Oracle',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'The picture is not on the surface – it lives in the angle. Walk around the oracle and it changes its mind.',
  placeholder: {
    color: hsl.integer(314, 68, 38),
    shading: 'smooth',
  },
} as const satisfies KnotData
