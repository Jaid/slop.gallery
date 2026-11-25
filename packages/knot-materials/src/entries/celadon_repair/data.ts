import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BdUi8mU2Rs29CX7; fixture: knot-material-shaders.
export default {
  id: 'celadon_repair',
  candidateId: 'claude_opus',
  title: 'Celadon Repair',
  createdAt: 1_791_585_164,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'It broke once, and the potter mended it with lacquer and gold. Now the fractures are the brightest thing about it – a history worn openly, a wound that catches the light.',
  placeholder: {
    color: hsl.integer(173, 26, 64),
    shading: 'glass',
  },
} as const satisfies KnotData
