import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'seraphim_glass',
  candidateId: 'gemini_argon',
  title: 'Seraphim Glass',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  flavorText: 'Gothic rose windows of gold-ruby and cobalt glass hold a vaulted nave inside; step around the knot and colored sunbeams sweep the dark.',
  placeholder: {
    color: hsl.integer(32, 24, 37),
    shading: 'glass',
  },
} as const satisfies KnotData
