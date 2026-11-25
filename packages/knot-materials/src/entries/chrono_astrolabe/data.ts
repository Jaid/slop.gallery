import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4AEfQg7Qgj1dEVQ.
export default {
  id: 'chrono_astrolabe',
  candidateId: 'gemini_flash',
  title: 'Chrono Astrolabe',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Wheels of gilded brass and blued steel interlock in perpetual counterpoint, measuring moments that never pass.',
  placeholder: {
    color: hsl.integer(86, 81, 75.6),
    shading: 'metal',
  },
} as const satisfies KnotData
