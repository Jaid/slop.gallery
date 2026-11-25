import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7mkaA7JC9cNnoS2; fixture: knot-material-shaders; result: success.
export default {
  id: 'salar',
  candidateId: 'deepseek',
  title: 'Salar',
  createdAt: 1_792_264_877,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'The old sea left its salt and its mirror. At noon the sky walks on the ground, and every crack is a river of turquoise.',
  placeholder: {
    color: hsl.integer(174, 6, 69),
    shading: 'stone',
  },
} as const satisfies KnotData
