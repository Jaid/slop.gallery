import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tesseract_echo',
  candidateId: 'hy',
  title: 'Tesseract Echo',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'A shape from elsewhere leaves repeating traces as it passes through this room.',
  placeholder: {
    color: hsl.integer(297, 100, 60),
    shading: 'ghost',
  },
} as const satisfies KnotData
