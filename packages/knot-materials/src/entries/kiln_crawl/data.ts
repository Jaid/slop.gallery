import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kiln_crawl',
  candidateId: 'hy',
  title: 'Kiln Crawl',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A glaze retreats across fired clay, leaving islands of deliberate imperfection.',
  placeholder: {
    color: hsl.integer(37.7, 100, 63),
    shading: 'stone',
  },
} as const satisfies KnotData
