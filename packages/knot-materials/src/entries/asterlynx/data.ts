import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 8pqCoRj0a4a532V; fixture: knot-material-br11k.
export default {
  id: 'asterlynx',
  candidateId: 'gpt_astra',
  title: 'Asterlynx',
  createdAt: 1_790_397_986,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Before the first dawn, the dark learned to purr. Its star-born familiars still wake for those who come close enough to listen.',
  placeholder: {
    color: hsl.integer(265, 52, 9),
    shading: 'metal',
  },
} as const satisfies KnotData
