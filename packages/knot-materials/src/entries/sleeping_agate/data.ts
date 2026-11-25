import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CbMOkykhfBD7NuC; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'sleeping_agate',
  candidateId: 'claude_haiku',
  title: 'Sleeping Agate',
  createdAt: 1_791_758_163,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A geode keeps its slow ledger: each band a season of silica, laid down so patiently that the stone still seems to breathe in its sleep.',
  placeholder: {
    color: hsl.integer(304, 25, 57),
    shading: 'stone',
  },
} as const satisfies KnotData
