import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CyxjCrlY15yEfmL; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'halcyon_bubble',
  candidateId: 'claude_sonnet',
  title: 'Halcyon Bubble',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'A held breath, thinner than a thought, paints the whole sky in slow rivers of borrowed color.',
  placeholder: {
    color: hsl.integer(240, 100, 77.4),
    shading: 'glass',
  },
} as const satisfies KnotData
