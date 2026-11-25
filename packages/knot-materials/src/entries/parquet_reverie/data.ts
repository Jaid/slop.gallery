import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'parquet_reverie',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  title: 'Parquet Reverie',
  createdAt: 1_789_816_097,
  flavorText: 'A cabinetmaker tiled a daydream with maple and rosewood, then misplaced every straight line.',
  placeholder: {
    color: hsl.integer(63, 62, 57),
    shading: 'smooth',
  },
} as const satisfies KnotData
