import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FazbrK93jHSafY1; fixture: knot-material-br11k.
export default {
  id: 'great_cat_emergence',
  candidateId: 'claude_opus',
  title: 'Great Cat Emergence',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'The old star charts never recorded the Great Cat. It only draws itself while someone is watching – and it is always watching back.',
  placeholder: {
    color: hsl.integer(266, 63, 10),
    shading: 'smooth',
  },
} as const satisfies KnotData
