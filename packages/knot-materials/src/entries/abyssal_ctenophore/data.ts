import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K45USvVjintSE0u; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_ctenophore',
  candidateId: 'gemini_argon',
  title: 'Abyssal Ctenophore',
  createdAt: 1_792_050_794,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.015,
  flavorText: 'Translucent bathypelagic gel pulsed by eight metachronal comb rows of iridescent cilia. Approach and its deep interior awakens with bioluminescent synapses.',
  placeholder: {
    color: hsl.integer(208, 49, 50),
    shading: 'glass',
  },
} as const satisfies KnotData
