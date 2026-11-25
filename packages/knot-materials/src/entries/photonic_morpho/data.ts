import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'photonic_morpho',
  candidateId: 'gemini_flash',
  title: 'Photonic Morpho',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: "Minute ridges persuade daylight to become the blue of a butterfly's wing.",
  placeholder: {
    color: hsl.integer(262.6, 100, 46),
    shading: 'smooth',
  },
} as const satisfies KnotData
