import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4AEfQg7Qgj1dEVQ.
export default {
  id: 'living_kintsugi',
  candidateId: 'gemini_flash',
  title: 'Living Kintsugi',
  createdAt: 1_790_309_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Ancient black lacquer cradles fractures that refuse to stay silent, mended with living gold that pulses like a beating heart.',
  placeholder: {
    color: hsl.integer(15, 50, 12),
    shading: 'smooth',
  },
} as const satisfies KnotData
