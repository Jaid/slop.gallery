import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AywadB8L9RF1tw9; fixture: knot-material-br11k.
export default {
  id: 'felis_noctis',
  candidateId: 'gpt_sol',
  title: 'Felis Noctis',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'They drew the sky into the shape of every cat they ever loved. Watch closely: the stars are still purring.',
  placeholder: {
    color: hsl.integer(268, 60, 17),
    shading: 'smooth',
  },
} as const satisfies KnotData
