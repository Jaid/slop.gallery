import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CyxjCrlY15yEfmL; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'harlequin_sunrise',
  candidateId: 'claude_sonnet',
  title: 'Harlequin Sunrise',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Every patch of this black opal keeps a different sunrise, and gives it away only to the one who moves.',
  placeholder: {
    color: hsl.integer(268, 40, 12),
    shading: 'glass',
  },
} as const satisfies KnotData
