import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'abyssal_nacre',
  candidateId: 'grok',
  title: 'Abyssal Nacre',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Pearl gathers in layers where even moonlight cannot settle.',
  placeholder: {
    color: hsl.integer(177, 71, 84),
    shading: 'glass',
  },
} as const satisfies KnotData
