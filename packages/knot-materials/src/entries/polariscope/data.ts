import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7mkaA7JC9cNnoS2; fixture: knot-material-shaders; result: success.
export default {
  id: 'polariscope',
  candidateId: 'deepseek',
  title: 'Polariscope',
  createdAt: 1_792_264_877,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Between crossed polarizers, every buried wound becomes a rainbow. Walk around it and the colors rearrange themselves like a confession.',
  placeholder: {
    color: hsl.integer(29, 8, 53),
    shading: 'glass',
  },
} as const satisfies KnotData
