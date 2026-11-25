import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4AEfQg7Qgj1dEVQ.
export default {
  id: 'gothic_vitrail',
  candidateId: 'gemini_flash',
  title: 'Gothic Vitrail',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Jeweled medieval glass bound in weathered lead catches the morning sun, transforming silent stone into an ocean of celestial fire.',
  placeholder: {
    color: hsl.integer(305, 91, 38),
    shading: 'glass',
  },
} as const satisfies KnotData
