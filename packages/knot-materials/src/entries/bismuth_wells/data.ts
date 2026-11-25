import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_wells',
  candidateId: 'gemini_flash',
  title: 'Bismuth Wells',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Terraced staircase pyramids step inward toward molten hollows, washed in vibrant oxidation bands.',
  displacement: 0.011,
  placeholder: {
    color: hsl.integer(301, 56, 64),
    shading: 'metal',
  },
} as const satisfies KnotData
