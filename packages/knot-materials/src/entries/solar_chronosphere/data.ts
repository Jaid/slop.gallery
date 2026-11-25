import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_chronosphere',
  candidateId: 'gemini_flash',
  title: 'Solar Chronosphere',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Convective granules churn beneath coronal arches, burning with the fierce pulse of a newborn star.',
  placeholder: {
    color: hsl.integer(43, 96, 57),
    shading: 'smooth',
  },
} as const satisfies KnotData
