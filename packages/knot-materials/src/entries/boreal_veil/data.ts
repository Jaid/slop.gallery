import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'boreal_veil',
  candidateId: 'mimo',
  title: 'Boreal Veil',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Curtains of polar light drift through the knot, as if the night itself were combed into silk.',
  placeholder: {
    color: hsl.integer(175, 91, 52),
    shading: 'ghost',
  },
} as const satisfies KnotData
