import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hadal_garden',
  candidateId: 'mimo',
  title: 'Hadal Garden',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A garden of patient light in a sea that never knew the sun. It blooms, it breathes, it watches you watching.',
  placeholder: {
    color: hsl.integer(229, 71, 29),
    shading: 'liquid',
  },
} as const satisfies KnotData
