import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'kerr_accretion',
  candidateId: 'gemini_argon',
  title: 'Kerr Accretion',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  displacement: 0.012,
  flavorText: 'Gravity ties itself in a relativistic knot: an incandescent Doppler disk of stolen starlight spirals around a core of absolute silence.',
  placeholder: {
    color: hsl.integer(27, 20, 37),
    shading: 'smooth',
  },
} as const satisfies KnotData
