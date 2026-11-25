import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aether_loom',
  candidateId: 'muse_spark',
  title: 'Aether Loom',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: 'Unseen hands weave the space between one star and the next.',
  placeholder: {
    color: hsl.integer(221, 99, 92),
    shading: 'fabric',
  },
} as const satisfies KnotData
