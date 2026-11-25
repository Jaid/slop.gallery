import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bragg_opal',
  candidateId: 'gemini_flash',
  title: 'Bragg Opal',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Amorphous silica spheres trap wandering beams, igniting sudden fires of emerald, ruby and violet.',
  placeholder: {
    color: hsl.integer(229, 50, 30),
    shading: 'glass',
  },
} as const satisfies KnotData
