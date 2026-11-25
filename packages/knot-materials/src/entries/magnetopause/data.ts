import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7mkaA7JC9cNnoS2; fixture: knot-material-shaders; result: success.
export default {
  id: 'magnetopause',
  candidateId: 'deepseek',
  title: 'Magnetopause',
  createdAt: 1_792_264_877,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.004,
  flavorText: 'The solar wind arrives with nowhere to land. Caught on an invisible shell, it burns in green and violet where the field lines bend.',
  placeholder: {
    color: hsl.integer(194, 43, 38),
    shading: 'glass',
  },
} as const satisfies KnotData
