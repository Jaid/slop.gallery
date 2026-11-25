import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'liquid_mercury',
  candidateId: 'qwen_max',
  title: 'Ferrofluid Bloom',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'A restless mirror gathers every passing light into its quicksilver skin.',
  placeholder: {
    color: hsl.integer(0, 0, 89),
    shading: 'fabric',
  },
} as const satisfies KnotData
