import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_labyrinth',
  candidateId: 'claude_opus',
  title: 'Bismuth Labyrinth',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A hyper-geometric maze of oxidized metal, its terraces shifting in impossible iridescent hues.',
  displacement: 0.035,
  placeholder: {
    color: hsl.integer(318, 45, 59),
    shading: 'metal',
  },
} as const satisfies KnotData
