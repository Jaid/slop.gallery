import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'stellar_flare',
  candidateId: 'gemini_flash',
  title: 'Stellar Flare',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Boiling convective granules and twisting magnetic loops bind thermonuclear fire to the winding path of the knot.',
  placeholder: {
    color: hsl.integer(46, 96, 62.3),
    shading: 'smooth',
  },
} as const satisfies KnotData
