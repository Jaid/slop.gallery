import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'seraphim_censers',
  candidateId: 'gemini_argon',
  title: 'Seraphim Censers',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.012,
  flavorText: 'Pierced gilt bronze opens over a sanctuary of velvet and rubies. Circle the knot and Gothic rose windows reveal a heart of living embers.',
  placeholder: {
    color: hsl.integer(60, 43, 62),
    shading: 'metal',
  },
} as const satisfies KnotData
