import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_faults',
  candidateId: 'mimo',
  title: 'Kintsugi Faults',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Where the vessel broke, gold remembers the shape of the wound and makes it the brightest seam.',
  displacement: 0.006,
  placeholder: {
    color: hsl.integer(136, 22, 73),
    shading: 'smooth',
  },
} as const satisfies KnotData
