import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_menagerie',
  candidateId: 'claude_opus',
  title: 'Amber Menagerie',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Time sealed a miniature wilderness inside the resin, but neglected to tell it that it was dead.',
  placeholder: {
    color: hsl.integer(63, 84, 52),
    shading: 'glass',
  },
} as const satisfies KnotData
