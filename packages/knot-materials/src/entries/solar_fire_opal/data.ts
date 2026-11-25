import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_fire_opal',
  candidateId: 'gemini_flash',
  title: 'Solar Fire Opal',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Trapped within dark volcanic glass, a hidden cosmos of iridescent fire awakens whenever the viewer turns.',
  placeholder: {
    color: hsl.integer(39, 87, 52),
    shading: 'glass',
  },
} as const satisfies KnotData
