import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 3gQGAbAm59HYY8k; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'gilded_glaze',
  candidateId: 'claude_haiku',
  title: 'Gilded Glaze',
  createdAt: 1_791_758_567,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Every hairline crack in this glaze was mended with liquid gold, so the old wounds now catch the light more than the whole vessel.',
  placeholder: {
    color: hsl.integer(182, 55, 30),
    shading: 'glass',
  },
} as const satisfies KnotData
