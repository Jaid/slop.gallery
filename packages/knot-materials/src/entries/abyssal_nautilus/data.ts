import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_nautilus',
  candidateId: 'gemini_argon',
  title: 'Abyssal Nautilus',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.018,
  flavorText: 'Septal chambers of wet mother-of-pearl spiral through the dark. Tilt your head and rose-emerald interference sweeps across each ribbed vault.',
  placeholder: {
    color: hsl.integer(64, 8, 69),
    shading: 'smooth',
  },
} as const satisfies KnotData
