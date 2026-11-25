import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7mkaA7JC9cNnoS2; fixture: knot-material-shaders; result: success.
export default {
  id: 'hoarfrost',
  candidateId: 'deepseek',
  title: 'Hoarfrost',
  createdAt: 1_792_264_877,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'The night exhaled once, and the dark lacquer grew a garden of ice. Every branch is a sentence the cold wrote and the morning will erase.',
  placeholder: {
    color: hsl.integer(260, 35, 14),
    shading: 'glass',
  },
} as const satisfies KnotData
