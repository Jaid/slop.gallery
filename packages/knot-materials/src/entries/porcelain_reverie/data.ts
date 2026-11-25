import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'porcelain_reverie',
  candidateId: 'gpt_astra',
  title: 'Porcelain Reverie',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Cobalt flowers dream beneath a moon-white glaze. Along their gilded stems, the last warmth of the kiln still wanders.',
  placeholder: {
    color: hsl.integer(211, 15, 89),
    shading: 'smooth',
  },
} as const satisfies KnotData
