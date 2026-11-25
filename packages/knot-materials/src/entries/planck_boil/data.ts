import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'planck_boil',
  candidateId: 'claude_opus',
  title: 'Planck Boil',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'At the smallest distance, spacetime boils with borrowed energy. The knot is the margin between real and unreal.',
  displacement: 0.027,
  placeholder: {
    color: hsl.integer(265, 63, 47),
    shading: 'ghost',
  },
} as const satisfies KnotData
