import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'rimebloom',
  candidateId: 'deepseek',
  title: 'Rimebloom',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.009,
  flavorText: 'Winter breathed on the dark, and a garden of knives and feathers answered. Nothing in it is warm except the light that visits.',
  placeholder: {
    color: hsl.integer(237, 12, 60),
    shading: 'glass',
  },
} as const satisfies KnotData
