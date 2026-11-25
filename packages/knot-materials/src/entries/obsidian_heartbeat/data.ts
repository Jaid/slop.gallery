import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_heartbeat',
  candidateId: 'muse_spark',
  title: 'Obsidian Heartbeat',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Muse Spark 1.3',
      slug: 'meta/muse-spark-1.3',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Warm light returns to the same dark fissures with every patient pulse.',
  placeholder: {
    color: hsl.integer(34, 100, 59.7),
    shading: 'stone',
  },
} as const satisfies KnotData
