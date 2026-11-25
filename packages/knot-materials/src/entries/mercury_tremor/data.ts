import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mercury_tremor',
  candidateId: 'mimo',
  title: 'Mercury Tremor',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A metal that never set. It trembles at your breath and keeps a perfect, upside-down portrait of the room.',
  displacement: 0.12,
  placeholder: {
    color: hsl.integer(248, 8, 77),
    shading: 'liquid',
  },
} as const satisfies KnotData
