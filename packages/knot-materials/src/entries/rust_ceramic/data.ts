import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'rust_ceramic',
  candidateId: 'claude_sonnet',
  title: 'Rust Ceramic',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Sonnet 5',
      slug: 'anthropic/claude-sonnet-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A warm, iron-colored skin records the slow meeting of fire and clay.',
  placeholder: {
    color: hsl.integer(57, 83, 52),
    shading: 'stone',
  },
} as const satisfies KnotData
