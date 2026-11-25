import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tiger_eye',
  candidateId: 'mimo',
  title: 'Tiger’s Eye',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Silk turned to stone, and one band of light that will not be caught – it slips away as you circle the knot.',
  placeholder: {
    color: hsl.integer(67, 85, 58),
    shading: 'stone',
  },
} as const satisfies KnotData
