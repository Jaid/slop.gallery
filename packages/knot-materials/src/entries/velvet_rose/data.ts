import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_rose',
  candidateId: 'mimo',
  title: 'Velvet Rose',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.022,
  flavorText: 'A rose that never wilts, wearing the last of the garden’s dew in the dark folds of its velvet.',
  placeholder: {
    color: hsl.integer(20, 92, 45),
    shading: 'fabric',
  },
} as const satisfies KnotData
