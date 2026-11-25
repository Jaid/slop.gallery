import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_shard',
  candidateId: 'claude_sonnet',
  title: 'Obsidian Shard',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A splinter of volcanic night carries one hard edge of daylight.',
  placeholder: {
    color: hsl.integer(285, 17, 12),
    shading: 'stone',
  },
} as const satisfies KnotData
