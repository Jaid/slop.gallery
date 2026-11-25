import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mnemonic_mercury',
  candidateId: 'muse_spark',
  title: 'Mnemonic Mercury',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: 'This silver surface seems to remember a room that you have already left.',
  placeholder: {
    color: hsl.integer(229, 33, 94),
    shading: 'liquid',
  },
} as const satisfies KnotData
