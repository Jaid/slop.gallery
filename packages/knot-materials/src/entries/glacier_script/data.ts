import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'glacier_script',
  candidateId: 'gpt_astra',
  title: 'Glacier Script',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Winter writes in planes of trapped air and blue light. The oldest sentences appear only when you move between them.',
  placeholder: {
    color: hsl.integer(225, 48, 68),
    shading: 'glass',
  },
} as const satisfies KnotData
