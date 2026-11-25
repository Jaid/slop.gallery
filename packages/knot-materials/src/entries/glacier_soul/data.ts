import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'glacier_soul',
  candidateId: 'muse_spark',
  title: 'Glacier Soul',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: "A cold blue presence stirs beneath the mountain's patient weight.",
  placeholder: {
    color: hsl.integer(219, 100, 87),
    shading: 'glass',
  },
} as const satisfies KnotData
