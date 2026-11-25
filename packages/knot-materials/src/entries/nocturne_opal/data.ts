import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nocturne_opal',
  candidateId: 'muse_spark',
  title: 'Nocturne Opal',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: "A low, colored melody moves through the stone's midnight chambers.",
  placeholder: {
    color: hsl.integer(288, 100, 57.6),
    shading: 'glass',
  },
} as const satisfies KnotData
