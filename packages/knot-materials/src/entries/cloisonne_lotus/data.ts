import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'cloisonne_lotus',
  candidateId: 'gemini_argon',
  title: 'Cloisonné Lotus',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  flavorText: 'Filigree brass wires bent by hand contain pools of vitrified cobalt, turquoise and Imperial ruby glass over a foil-stamped guilloché core.',
  placeholder: {
    color: hsl.integer(103, 10, 50),
    shading: 'glass',
  },
} as const satisfies KnotData
