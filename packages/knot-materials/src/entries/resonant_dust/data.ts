import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: H32IciRDAWJfwki; fixture: knot-material-shaders; result: success.
export default {
  id: 'resonant_dust',
  candidateId: 'claude_sonnet',
  title: 'Resonant Dust',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'The plate sings a note too low to hear. Step closer and the music grows finer, herding every grain into a new geometry.',
  placeholder: {
    color: hsl.integer(78, 45, 49),
    shading: 'stone',
  },
} as const satisfies KnotData
