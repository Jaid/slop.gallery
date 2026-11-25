import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'blue_hour',
  candidateId: 'mimo',
  title: 'Blue Hour',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Porcelain painted with the last blue of evening and sealed under a glaze of quiet glass.',
  placeholder: {
    color: hsl.integer(266, 87, 32),
    shading: 'stone',
  },
} as const satisfies KnotData
