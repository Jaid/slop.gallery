import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quicksilver_aurora',
  candidateId: 'muse_spark',
  title: 'Quicksilver Aurora',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Northern light slips across mercury like a sky poured into a bowl.',
  placeholder: {
    color: hsl.integer(199, 99, 90),
    shading: 'liquid',
  },
} as const satisfies KnotData
