import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_flare_plasma',
  candidateId: 'claude_sonnet',
  title: 'Solar Flare Plasma',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A small captive eruption keeps reaching for a sky beyond its vessel.',
  placeholder: {
    color: hsl.integer(45, 100, 65),
    shading: 'liquid',
  },
} as const satisfies KnotData
