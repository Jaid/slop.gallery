import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'celestial_armillary',
  candidateId: 'gemini_argon',
  title: 'Celestial Armillary',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  flavorText: 'Graduated brass meridians and engraved vernier rings cage a deep indigo planetarium where golden constellations and comets wheel.',
  placeholder: {
    color: hsl.integer(65, 15, 44),
    shading: 'metal',
  },
} as const satisfies KnotData
