import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'photinus_synchrony',
  candidateId: 'claude_opus',
  title: 'Photinus Synchrony',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A swarm of fireflies has chosen the knot as their midnight forest, pulsing toward a single breath.',
  displacement: 0.006,
  placeholder: {
    color: hsl.integer(141, 61, 33),
    shading: 'stone',
  },
} as const satisfies KnotData
