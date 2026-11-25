import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'basalt_flux',
  candidateId: 'claude_opus',
  title: 'Basalt Flux',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Black stone yields, just enough to reveal the furnace underneath.',
  placeholder: {
    color: hsl.integer(33.3, 100, 59.6),
    shading: 'stone',
  },
  displacement: 0.015,
} as const satisfies KnotData
