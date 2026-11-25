import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_bloom',
  candidateId: 'mimo',
  title: 'Abyssal Bloom',
  createdAt: 1_789_094_423,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.01,
  flavorText: 'Something ancient blooms in the dark, its nerves lit with cold fire, feeling its way along the endless knot.',
  placeholder: {
    color: hsl.integer(247, 56, 12),
    shading: 'glass',
  },
} as const satisfies KnotData
