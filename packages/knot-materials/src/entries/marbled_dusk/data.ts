import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CyxjCrlY15yEfmL; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'marbled_dusk',
  candidateId: 'claude_sonnet',
  title: 'Marbled Dusk',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Pigment floats on still water until a comb drags a whole evening through it, and the paper keeps the current.',
  placeholder: {
    color: hsl.integer(348, 81, 27),
    shading: 'smooth',
  },
} as const satisfies KnotData
