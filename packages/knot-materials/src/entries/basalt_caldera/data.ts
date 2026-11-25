import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K45USvVjintSE0u; fixture: knot-material-shaders; result: success.
export default {
  id: 'basalt_caldera',
  candidateId: 'gemini_argon',
  title: 'Basalt Caldera',
  createdAt: 1_792_050_794,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.014,
  flavorText: 'Hexagonal basalt columns and quenched obsidian glass fracture over a river of white-hot pahoehoe magma. Draw near and the bellows of the earth roar.',
  placeholder: {
    color: hsl.integer(39, 67, 40),
    shading: 'stone',
  },
} as const satisfies KnotData
