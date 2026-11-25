import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'river_of_gold',
  candidateId: 'mimo',
  title: 'River of Gold',
  createdAt: 1_792_098_068,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Shattered on purpose, mended with gold. The seam is not a scar but a river of light through the dark clay.',
  placeholder: {
    color: hsl.integer(67, 21, 10),
    shading: 'stone',
  },
} as const satisfies KnotData
