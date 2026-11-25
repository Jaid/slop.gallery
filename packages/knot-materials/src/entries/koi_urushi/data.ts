import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'koi_urushi',
  candidateId: 'gemini_argon',
  title: 'Koi Urushi',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  flavorText: 'Midnight urushi lacquer holds an autumn koi pond: gold maki-e waves and mother-of-pearl raden shells shimmer above drifting lanterns.',
  placeholder: {
    color: hsl.integer(77, 20, 50),
    shading: 'smooth',
  },
} as const satisfies KnotData
