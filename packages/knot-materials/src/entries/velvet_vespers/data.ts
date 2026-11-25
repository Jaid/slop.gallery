import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_vespers',
  candidateId: 'gpt_astra',
  title: 'Velvet Vespers',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'A twilight vestment woven for no earthly ceremony. Rose-gold damask rises from wine-dark velvet as the light turns.',
  placeholder: {
    color: hsl.integer(353, 64, 19),
    shading: 'fabric',
  },
} as const satisfies KnotData
