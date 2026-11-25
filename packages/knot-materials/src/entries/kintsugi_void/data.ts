import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_void',
  candidateId: 'kimi',
  title: 'Kintsugi Void',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'Bright seams hold together pieces of an otherwise unbroken darkness.',
  placeholder: {
    color: hsl.integer(90, 100, 87),
    shading: 'stone',
  },
} as const satisfies KnotData
