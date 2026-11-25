import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'celadon_crackle',
  candidateId: 'claude_opus',
  title: 'Celadon Crackle',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A quiet green glaze holds a map of the moments it cooled.',
  placeholder: {
    color: hsl.integer(165, 32, 76),
    shading: 'stone',
  },
} as const satisfies KnotData
