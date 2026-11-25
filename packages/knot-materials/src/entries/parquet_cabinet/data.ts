import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'parquet_cabinet',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  title: 'Parquet Cabinet',
  createdAt: 1_789_816_097,
  flavorText: 'Maple and rosewood trade places at every joint, guarding a room too small to enter.',
  placeholder: {
    color: hsl.integer(60, 63, 57),
    shading: 'smooth',
  },
} as const satisfies KnotData
