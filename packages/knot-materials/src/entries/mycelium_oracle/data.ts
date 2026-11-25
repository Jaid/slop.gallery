import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelium_oracle',
  candidateId: 'muse_spark',
  title: 'Mycelium Oracle',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The network grows an answer before the question reaches its roots.',
  placeholder: {
    color: hsl.integer(131, 100, 90.6),
    shading: 'fabric',
  },
} as const satisfies KnotData
