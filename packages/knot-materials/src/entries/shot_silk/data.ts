import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ImzJ438LsWTlcom; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'shot_silk',
  candidateId: 'claude_haiku',
  title: 'Shot Silk',
  createdAt: 1_791_759_582,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Warp and weft were dyed to disagree, so the cloth answers every step you take with a different color.',
  placeholder: {
    color: hsl.integer(312, 42, 37),
    shading: 'fabric',
  },
} as const satisfies KnotData
