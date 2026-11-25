import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chitinous_elytra',
  candidateId: 'gemini_flash',
  title: 'Chitinous Elytra',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Corrugated jewel-beetle armor splits the daylight into iridescent sheens of peacock green and gold.',
  displacement: 0.007,
  placeholder: {
    color: hsl.integer(134, 61, 45),
    shading: 'smooth',
  },
} as const satisfies KnotData
