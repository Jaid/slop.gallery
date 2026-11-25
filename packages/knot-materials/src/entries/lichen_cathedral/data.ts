import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lichen_cathedral',
  candidateId: 'muse_spark',
  title: 'Lichen Cathedral',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: 'A patient green congregation grows across the stones of a forgotten sanctuary.',
  placeholder: {
    color: hsl.integer(149.6, 100, 85.7),
    shading: 'smooth',
  },
  displacement: 0.025,
} as const satisfies KnotData
