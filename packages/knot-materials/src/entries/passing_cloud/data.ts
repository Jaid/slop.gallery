import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BdUi8mU2Rs29CX7; fixture: knot-material-shaders.
export default {
  id: 'passing_cloud',
  candidateId: 'claude_opus',
  title: 'Passing Cloud',
  createdAt: 1_791_585_164,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Dark clouds sweep over a cuttlefish’s skin as it thinks. Look at it long enough and it looks back – the skin pales where your gaze rests, and a hidden rainbow surfaces.',
  placeholder: {
    color: hsl.integer(220, 21, 62),
    shading: 'smooth',
  },
} as const satisfies KnotData
