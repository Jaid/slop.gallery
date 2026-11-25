import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'diamond_cathedral',
  candidateId: 'muse_spark',
  title: 'Diamond Cathedral',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Light kneels in a chamber built entirely from its own reflections.',
  placeholder: {
    color: hsl.integer(212, 100, 97),
    shading: 'smooth',
  },
} as const satisfies KnotData
