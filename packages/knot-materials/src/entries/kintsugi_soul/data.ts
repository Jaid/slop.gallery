import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_soul',
  candidateId: 'hy',
  title: 'Kintsugi Soul',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'The repaired places have become the brightest part of the whole.',
  placeholder: {
    color: hsl.integer(69, 100, 79.5),
    shading: 'stone',
  },
} as const satisfies KnotData
