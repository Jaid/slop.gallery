import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7mkaA7JC9cNnoS2; fixture: knot-material-shaders; result: success.
export default {
  id: 'zebrawood',
  candidateId: 'deepseek',
  title: 'Zebrawood',
  createdAt: 1_792_264_877,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'The tree kept every year inside itself. Cut across the grain, the knot confesses a century of weather in amber.',
  placeholder: {
    color: hsl.integer(66, 39, 57),
    shading: 'smooth',
  },
} as const satisfies KnotData
