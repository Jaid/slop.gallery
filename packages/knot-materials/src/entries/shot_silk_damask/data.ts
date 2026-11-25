import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 8EWpDkWx6nfkCqt; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'shot_silk_damask',
  candidateId: 'claude_sonnet',
  title: 'Shot Silk Damask',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Crimson warp, teal weft, a single thread of gold. The pattern is a rumor until the light arrives from the right direction.',
  placeholder: {
    color: hsl.integer(24, 97, 28),
    shading: 'fabric',
  },
} as const satisfies KnotData
