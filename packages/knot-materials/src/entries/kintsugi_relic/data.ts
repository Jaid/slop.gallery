import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_relic',
  candidateId: 'gemini_flash',
  title: 'Kintsugi Relic',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Imperial celadon porcelain bears its ancient fractures with pride, mended forever in thick veins of celestial gold.',
  displacement: 0.014,
  placeholder: {
    color: hsl.integer(129, 21, 71),
    shading: 'smooth',
  },
} as const satisfies KnotData
