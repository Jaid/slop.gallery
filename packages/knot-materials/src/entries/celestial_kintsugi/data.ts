import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'celestial_kintsugi',
  candidateId: 'gemini_flash',
  title: 'Celestial Kintsugi',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Fractured eggshell porcelain mended with seams of pure liquid gold, turning fragile brokenness into sacred art.',
  placeholder: {
    color: hsl.integer(80, 25, 89),
    shading: 'smooth',
  },
} as const satisfies KnotData
