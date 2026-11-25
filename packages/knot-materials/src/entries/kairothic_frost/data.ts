import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kairothic_frost',
  candidateId: 'muse_spark',
  title: 'Kairothic Frost',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: 'These crystals wait for the right moment, not the next one.',
  placeholder: {
    color: hsl.integer(225, 100, 87.4),
    shading: 'glass',
  },
  displacement: 0.018,
} as const satisfies KnotData
