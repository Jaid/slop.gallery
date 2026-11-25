import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BdUi8mU2Rs29CX7; fixture: knot-material-shaders.
export default {
  id: 'heartwood',
  candidateId: 'claude_opus',
  title: 'Heartwood',
  createdAt: 1_791_585_164,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Carved from an old maple and sealed in amber. Its curl rolls like water under ice as you pass, and a vanished forest’s dappled light still drifts across the grain.',
  placeholder: {
    color: hsl.integer(66, 67, 54),
    shading: 'smooth',
  },
} as const satisfies KnotData
