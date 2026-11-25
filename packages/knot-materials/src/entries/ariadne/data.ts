import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'ariadne',
  candidateId: 'deepseek',
  title: 'Ariadne',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.004,
  flavorText: 'A single thread remembers the way through every knot. Follow it, and the dark begins to sing in colors it has never learned.',
  placeholder: {
    color: hsl.integer(289, 11, 49),
    shading: 'fabric',
  },
} as const satisfies KnotData
