import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'morpho_reliquary',
  candidateId: 'gemini_argon',
  title: 'Morpho Reliquary',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.011,
  flavorText: 'Shingled chitin scales diffracting electric cobalt and emerald violet shift with every step, parted by dark wing veins of liquid gold.',
  placeholder: {
    color: hsl.integer(243, 18, 61),
    shading: 'smooth',
  },
} as const satisfies KnotData
