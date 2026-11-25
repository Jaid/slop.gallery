import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sumi_tide',
  candidateId: 'claude_opus',
  title: 'Sumi Tide',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'The brush has vanished, yet its final gesture continues to wander through the paper.',
  displacement: 0.003,
  placeholder: {
    color: hsl.integer(85, 18, 81),
    shading: 'smooth',
  },
} as const satisfies KnotData
