import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_regalia',
  candidateId: 'mimo',
  title: 'Velvet Regalia',
  createdAt: 1_790_036_112,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.5 Pro',
      slug: 'xiaomi/mimo-v2.5-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Wine-dark pile drinks the light whole, then breathes it back as gold thread and a regal hush.',
  displacement: 0.005,
  placeholder: {
    color: hsl.integer(13, 82, 18),
    shading: 'fabric',
  },
} as const satisfies KnotData
