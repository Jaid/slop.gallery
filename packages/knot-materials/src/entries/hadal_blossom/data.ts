import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hadal_blossom',
  candidateId: 'muse_spark',
  title: 'Abyssal Bloom',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A flower opens where the ocean is deepest and no season ever changes.',
  placeholder: {
    color: hsl.integer(202, 100, 85),
    shading: 'fabric',
  },
  displacement: 0.02,
} as const satisfies KnotData
