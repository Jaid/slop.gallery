import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'moonspun_silk',
  candidateId: 'mimo',
  title: 'Moonspun Silk',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Cloth woven from moth-wing and moonlight; the luster rolls across it like a slow silver tide.',
  placeholder: {
    color: hsl.integer(292, 27, 46),
    shading: 'fabric',
  },
} as const satisfies KnotData
