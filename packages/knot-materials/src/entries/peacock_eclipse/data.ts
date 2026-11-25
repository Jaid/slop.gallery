import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CyxjCrlY15yEfmL; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'peacock_eclipse',
  candidateId: 'claude_sonnet',
  title: 'Peacock Eclipse',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'A thousand barbs hold no pigment, only geometry – and every eye that opens is looking back at you.',
  placeholder: {
    color: hsl.integer(159, 96, 40),
    shading: 'fabric',
  },
} as const satisfies KnotData
