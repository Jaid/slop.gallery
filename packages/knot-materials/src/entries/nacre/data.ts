import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre',
  candidateId: 'mimo',
  title: 'Nacre',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The shell keeps a rainbow it never earned – a thousand thin years of moonlight folded into one skin.',
  placeholder: {
    color: hsl.integer(343, 10, 81),
    shading: 'glass',
  },
} as const satisfies KnotData
