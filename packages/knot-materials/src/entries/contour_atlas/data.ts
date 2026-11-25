import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'contour_atlas',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  title: 'Contour Atlas',
  createdAt: 1_789_816_097,
  flavorText: 'An uncharted coast folds back on itself; every ink line measures a place no traveler can reach.',
  displacement: 0.008,
  placeholder: {
    color: hsl.integer(163, 34, 72),
    shading: 'stone',
  },
} as const satisfies KnotData
