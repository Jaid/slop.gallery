import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'paper_cathedral',
  candidateId: 'gpt_astra',
  title: 'Paper Cathedral',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Seven pierced pages hold a sanctuary between them. Ivory petals descend toward a rose-colored light that never becomes a flame.',
  displacement: 0.013,
  placeholder: {
    color: hsl.integer(82, 32, 81),
    shading: 'smooth',
  },
} as const satisfies KnotData
