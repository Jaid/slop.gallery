import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'oxide_ziggurat',
  candidateId: 'gemini_argon',
  title: 'Oxide Ziggurat',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  displacement: 0.018,
  flavorText: 'Hopper crystals grow faster at their edges than their centers, building terraced metallic ziggurats cloaked in every interference color of oxide.',
  placeholder: {
    color: hsl.integer(11, 13, 51),
    shading: 'metal',
  },
} as const satisfies KnotData
