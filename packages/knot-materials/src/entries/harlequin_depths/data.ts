import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1o1ree11eGriGjv; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'harlequin_depths',
  candidateId: 'claude_sonnet',
  title: 'Harlequin Depths',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Millions of silica spheres settle into ordered patches, and every patch answers a different angle with its own color.',
  placeholder: {
    color: hsl.integer(265, 88, 16),
    shading: 'glass',
  },
} as const satisfies KnotData
