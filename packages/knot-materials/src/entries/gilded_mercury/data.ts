import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gilded_mercury',
  candidateId: 'mimo',
  title: 'Gilded Mercury',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A metal that refuses to hold still. Every step you take rearranges the whole room inside its skin.',
  placeholder: {
    color: hsl.integer(234, 4, 67),
    shading: 'liquid',
  },
} as const satisfies KnotData
