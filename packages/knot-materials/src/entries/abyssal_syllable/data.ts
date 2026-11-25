import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_syllable',
  candidateId: 'deepseek',
  title: 'Abyssal Syllable',
  createdAt: 1_790_125_939,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'The ocean has hidden a last blue syllable inside this shell.',
  placeholder: {
    color: hsl.integer(176, 98, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
