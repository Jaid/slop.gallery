import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'porcelain_constellation',
  candidateId: 'muse_spark',
  title: 'Porcelain Constellation',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Small stars gather beneath a glaze as pale as an unmarked map.',
  placeholder: {
    color: hsl.integer(89, 100, 88),
    shading: 'stone',
  },
} as const satisfies KnotData
