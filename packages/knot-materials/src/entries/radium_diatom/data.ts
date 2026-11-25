import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 77fsRvmePazcbTS; fixture: knot-material-shaders; result: success.
export default {
  id: 'radium_diatom',
  candidateId: 'gemini_argon',
  title: 'Radium Diatom',
  createdAt: 1_791_968_199,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'low',
    },
  },
  displacement: 0.014,
  flavorText: 'Microscopic glass cathedrals of the abyssal sea: radially symmetric silica frustules glow with Cherenkov blue and emerald bioluminescence.',
  placeholder: {
    color: hsl.integer(205, 6, 44),
    shading: 'glass',
  },
} as const satisfies KnotData
