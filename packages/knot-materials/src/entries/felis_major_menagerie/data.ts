import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: C9HMqRObyAfKheL; fixture: knot-material-br11k; result: mixed.
export default {
  id: 'felis_major_menagerie',
  candidateId: 'claude_opus',
  title: 'Felis Major Menagerie',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Old star charts left out a few figures: cats of light that watch you pass, forget themselves into stardust and, eyes first, remember.',
  placeholder: {
    color: hsl.integer(275, 32, 4),
    shading: 'smooth',
  },
} as const satisfies KnotData
