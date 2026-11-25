import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'noble_opal',
  candidateId: 'deepseek',
  title: 'Noble Opal',
  createdAt: 1_789_949_253,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A million silica spheres hold their breath, and the light answers in colors that were never there.',
  placeholder: {
    color: hsl.integer(307, 31, 77),
    shading: 'glass',
  },
} as const satisfies KnotData
