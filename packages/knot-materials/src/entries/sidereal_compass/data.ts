import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sidereal_compass',
  candidateId: 'hy',
  title: 'Celestial Astrolabe',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'Hy4 Preview',
      slug: 'tencent/hy4-preview',
      effortLevel: 'high',
    },
  },
  flavorText: 'Its fine markings point toward stars rather than any earthly north.',
  placeholder: {
    color: hsl.integer(84, 64, 80),
    shading: 'smooth',
  },
} as const satisfies KnotData
