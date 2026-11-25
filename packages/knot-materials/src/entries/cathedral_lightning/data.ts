import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cathedral_lightning',
  candidateId: 'muse_spark',
  title: 'Cathedral Lightning',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: 'Thunder has left its illuminated handwriting in a crystal nave.',
  placeholder: {
    color: hsl.integer(206, 100, 87.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
