import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'turquoise_heartwood',
  candidateId: 'gpt_astra',
  title: 'Turquoise Heartwood',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'A forest folds its years into polished chambers. Turquoise rivers thread the grain, carrying a slow song back to the roots.',
  placeholder: {
    color: hsl.integer(62, 45, 30),
    shading: 'smooth',
  },
} as const satisfies KnotData
