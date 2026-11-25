import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7mkaA7JC9cNnoS2; fixture: knot-material-shaders; result: success.
export default {
  id: 'sumi',
  candidateId: 'deepseek',
  title: 'Sumi',
  createdAt: 1_792_264_877,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A mountain range, a red sun and the breath that put them there. The paper still holds the weight of the brush.',
  placeholder: {
    color: hsl.integer(71, 9, 54),
    shading: 'smooth',
  },
} as const satisfies KnotData
