import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_obsidian',
  candidateId: 'claude_fable',
  title: 'Kintsugi Obsidian',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Gold traces a careful apology across the broken black glass.',
  placeholder: {
    color: hsl.integer(87, 100, 87.8),
    shading: 'stone',
  },
} as const satisfies KnotData
