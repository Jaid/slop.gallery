import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7MpiHPKoZbL8ZDK; fixture: knot-material-br11k.
export default {
  id: 'felis_astra',
  candidateId: 'gpt_astra',
  title: 'Felis Astra',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'The night has nine lives. Beneath a skin of blue obsidian, patient stars learn to purr – and follow you with eyes of gold.',
  placeholder: {
    color: hsl.integer(271, 48, 10),
    shading: 'smooth',
  },
} as const satisfies KnotData
