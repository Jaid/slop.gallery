import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chladni_resonance',
  candidateId: 'claude_fable',
  title: 'Chladni Resonance',
  createdAt: 1_789_239_146,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'max',
    },
  },
  flavorText: 'Silent music teaches pale grains where to gather.',
  placeholder: {
    color: hsl.integer(88, 48, 87),
    shading: 'smooth',
  },
  displacement: 0.006,
} as const satisfies KnotData
