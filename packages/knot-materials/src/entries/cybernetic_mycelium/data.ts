import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'cybernetic_mycelium',
  candidateId: 'gemini_argon',
  title: 'Cybernetic Mycelium',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  displacement: 0.011,
  flavorText: 'Bioluminescent fungal hyphae colonizing a liquid-mercury substrate: synaptic action potentials race from node to node beneath glistening dew.',
  placeholder: {
    color: hsl.integer(155, 17, 53),
    shading: 'liquid',
  },
} as const satisfies KnotData
