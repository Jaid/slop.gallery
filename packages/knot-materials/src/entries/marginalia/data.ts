import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'marginalia',
  candidateId: 'deepseek',
  title: 'Marginalia',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A vanished hand keeps writing: the nib of light moves on, and the words it leaves behind wait to be read.',
  placeholder: {
    color: hsl.integer(80, 39, 60),
    shading: 'smooth',
  },
} as const satisfies KnotData
