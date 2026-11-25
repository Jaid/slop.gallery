import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tempest_eye',
  candidateId: 'muse_spark',
  title: 'Tempest Eye',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The calm center watches its own storm turn without ever joining it.',
  placeholder: {
    color: hsl.integer(288, 100, 65),
    shading: 'smooth',
  },
} as const satisfies KnotData
