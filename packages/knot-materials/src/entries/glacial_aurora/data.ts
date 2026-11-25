import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'glacial_aurora',
  candidateId: 'claude_fable',
  title: 'Glacial Aurora',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Northern light moves slowly through the memory of ancient ice.',
  placeholder: {
    color: hsl.integer(155.3, 100, 86.3),
    shading: 'glass',
  },
} as const satisfies KnotData
