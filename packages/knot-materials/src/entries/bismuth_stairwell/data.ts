import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CyxjCrlY15yEfmL; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'bismuth_stairwell',
  candidateId: 'claude_sonnet',
  title: 'Bismuth Stairwell',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Crystals grew inward, stair by stair, and every step remembers the color of the air it met.',
  placeholder: {
    color: hsl.integer(303, 12, 39),
    shading: 'metal',
  },
} as const satisfies KnotData
